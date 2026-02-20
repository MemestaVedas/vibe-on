use super::reverb::Freeverb;
use rodio::Source;
use std::f32::consts::PI;
use std::sync::{Arc, Mutex};

#[derive(Clone, Copy, Debug)]
struct BiquadCoeffs {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
}

impl BiquadCoeffs {
    fn new() -> Self {
        Self {
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum FilterType {
    LowShelf,
    Peaking,
    HighShelf,
}

struct BiquadFilter {
    coeffs: BiquadCoeffs,
    filter_type: FilterType,
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl BiquadFilter {
    fn new(filter_type: FilterType) -> Self {
        Self {
            coeffs: BiquadCoeffs::new(),
            filter_type,
            x1: 0.0,
            x2: 0.0,
            y1: 0.0,
            y2: 0.0,
        }
    }

    fn update_coeffs(&mut self, frequency: f32, sample_rate: u32, gain_db: f32, q: f32) {
        // Bypass filter when gain is 0dB (flat response)
        if gain_db == 0.0 {
            self.coeffs = BiquadCoeffs::new();
            return;
        }

        let w0 = 2.0 * PI * frequency / sample_rate as f32;
        let a = 10.0f32.powf(gain_db / 40.0);
        let alpha = w0.sin() / (2.0 * q);
        let cos_w0 = w0.cos();

        let (b0, b1, b2, a0, a1, a2) = match self.filter_type {
            FilterType::LowShelf => {
                let sqrt_a = a.sqrt();
                let sa = 2.0 * sqrt_a * alpha;

                let b0 = a * ((a + 1.0) - (a - 1.0) * cos_w0 + sa);
                let b1 = 2.0 * a * ((a - 1.0) - (a + 1.0) * cos_w0);
                let b2 = a * ((a + 1.0) - (a - 1.0) * cos_w0 - sa);
                let a0 = (a + 1.0) + (a - 1.0) * cos_w0 + sa;
                let a1 = -2.0 * ((a - 1.0) + (a + 1.0) * cos_w0);
                let a2 = (a + 1.0) + (a - 1.0) * cos_w0 - sa;

                (b0, b1, b2, a0, a1, a2)
            }
            FilterType::HighShelf => {
                let sqrt_a = a.sqrt();
                let sa = 2.0 * sqrt_a * alpha;

                let b0 = a * ((a + 1.0) + (a - 1.0) * cos_w0 + sa);
                let b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * cos_w0);
                let b2 = a * ((a + 1.0) + (a - 1.0) * cos_w0 - sa);
                let a0 = (a + 1.0) - (a - 1.0) * cos_w0 + sa;
                let a1 = 2.0 * ((a - 1.0) - (a + 1.0) * cos_w0);
                let a2 = (a + 1.0) - (a - 1.0) * cos_w0 - sa;

                (b0, b1, b2, a0, a1, a2)
            }
            FilterType::Peaking => {
                let b0 = 1.0 + alpha * a;
                let b1 = -2.0 * cos_w0;
                let b2 = 1.0 - alpha * a;
                let a0 = 1.0 + alpha / a;
                let a1 = -2.0 * cos_w0;
                let a2 = 1.0 - alpha / a;

                (b0, b1, b2, a0, a1, a2)
            }
        };

        self.coeffs.b0 = b0 / a0;
        self.coeffs.b1 = b1 / a0;
        self.coeffs.b2 = b2 / a0;
        self.coeffs.a1 = a1 / a0;
        self.coeffs.a2 = a2 / a0;
    }

    fn process(&mut self, sample: f32) -> f32 {
        let output = self.coeffs.b0 * sample + self.coeffs.b1 * self.x1 + self.coeffs.b2 * self.x2
            - self.coeffs.a1 * self.y1
            - self.coeffs.a2 * self.y2;

        self.x2 = self.x1;
        self.x1 = sample;
        self.y2 = self.y1;
        self.y1 = output;

        output
    }
}

pub struct Equalizer<I>
where
    I: Source<Item = f32>,
{
    input: I,
    filters: Vec<Vec<BiquadFilter>>,
    gains: Arc<Mutex<Vec<f32>>>,
    sample_rate: u32,
    channels: u16,
    current_channel: usize,
    frequencies: [f32; 10],
    cached_gains: Vec<f32>,
    update_counter: usize,
    pending_sample: Option<f32>,
    reverb: Freeverb,
}

impl<I> Equalizer<I>
where
    I: Source<Item = f32>,
{
    pub fn new(input: I, gains: Arc<Mutex<Vec<f32>>>) -> Self {
        let sample_rate = input.sample_rate();
        let channels = input.channels();

        let frequencies = [
            31.0, 62.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0,
        ];

        let mut filters = Vec::with_capacity(channels as usize);
        for _ in 0..channels {
            let mut channel_filters = Vec::with_capacity(10);
            for (i, _) in frequencies.iter().enumerate() {
                let filter_type = if i == 0 {
                    FilterType::LowShelf
                } else if i == 9 {
                    FilterType::HighShelf
                } else {
                    FilterType::Peaking
                };
                channel_filters.push(BiquadFilter::new(filter_type));
            }
            filters.push(channel_filters);
        }

        let mut eq = Self {
            input,
            filters,
            gains,
            sample_rate,
            channels,
            current_channel: 0,
            frequencies,
            cached_gains: vec![0.0; 15],
            update_counter: 0,
            pending_sample: None,
            reverb: Freeverb::new(sample_rate as u32),
        };

        eq.recalculate_coeffs();
        println!(
            "[Equalizer] Created new instance for {} channels at {} Hz",
            channels, sample_rate
        );
        eq
    }

    fn recalculate_coeffs(&mut self) {
        let mut _coeffs_updated = false;
        if let Ok(gains) = self.gains.try_lock() {
            if gains.len() >= 10 {
                if self.cached_gains.len() < gains.len() {
                    self.cached_gains.resize(gains.len(), 0.0);
                }

                for (i, &g) in gains.iter().enumerate() {
                    if self.cached_gains[i] != g {
                        println!("[Equalizer] Band {} gain changed to {} dB", i, g);
                        self.cached_gains[i] = g;
                        _coeffs_updated = true;
                    }
                }
            }
        }

        // Always update coefficients on first call or when gains changed
        let q = 1.0;
        for channel_idx in 0..self.channels as usize {
            for (band_idx, filter) in self.filters[channel_idx].iter_mut().enumerate() {
                let gain = if band_idx < self.cached_gains.len() {
                    self.cached_gains[band_idx]
                } else {
                    0.0
                };

                filter.update_coeffs(self.frequencies[band_idx], self.sample_rate, gain, q);
            }
        }
    }
}

impl<I> Iterator for Equalizer<I>
where
    I: Source<Item = f32>,
{
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        if let Some(sample) = self.pending_sample.take() {
            return Some(sample);
        }

        self.update_counter += 1;
        if self.update_counter > 1000 {
            self.recalculate_coeffs();
            self.update_counter = 0;
        }

        let mut left = self.input.next()?;

        let mut right = if self.channels == 2 {
            match self.input.next() {
                Some(s) => s,
                None => return Some(left),
            }
        } else {
            0.0
        };

        if self.channels == 2 {
            if 0 < self.filters.len() {
                for filter in self.filters[0].iter_mut() {
                    left = filter.process(left);
                }
            }
            if 1 < self.filters.len() {
                for filter in self.filters[1].iter_mut() {
                    right = filter.process(right);
                }
            }
        } else {
            if self.current_channel < self.filters.len() {
                for filter in self.filters[self.current_channel].iter_mut() {
                    left = filter.process(left);
                }
            }
            self.current_channel = (self.current_channel + 1) % (self.channels as usize);
            return Some(left);
        }

        let preamp_db = *self.cached_gains.get(10).unwrap_or(&0.0);
        if preamp_db != 0.0 {
            let factor = 10.0f32.powf(preamp_db / 20.0);
            left *= factor;
            right *= factor;
        }

        let width_factor = *self.cached_gains.get(12).unwrap_or(&1.0);

        if (width_factor - 1.0).abs() > 0.01 {
            let mid = (left + right) * 0.5;
            let side = (left - right) * 0.5;
            let new_side = side * width_factor;
            left = mid + new_side;
            right = mid - new_side;
        }

        let balance = *self.cached_gains.get(11).unwrap_or(&0.0);
        if balance != 0.0 {
            if balance < 0.0 {
                right *= 1.0 + balance;
            } else {
                left *= 1.0 - balance;
            }
        }

        let reverb_mix = *self.cached_gains.get(13).unwrap_or(&0.0);
        let reverb_decay = *self.cached_gains.get(14).unwrap_or(&0.5);

        if reverb_mix > 0.0 {
            self.reverb.set_room_size(reverb_decay);
            self.reverb.set_wet(reverb_mix);
            self.reverb.set_dry(0.0); // Freeverb handles mixing internally

            let (rev_l, rev_r) = self.reverb.process(left, right);
            left = rev_l;
            right = rev_r;
        }

        self.pending_sample = Some(right);
        Some(left)
    }
}

impl<I> Source for Equalizer<I>
where
    I: Source<Item = f32>,
{
    fn current_frame_len(&self) -> Option<usize> {
        self.input.current_frame_len()
    }

    fn channels(&self) -> u16 {
        self.channels
    }

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn total_duration(&self) -> Option<std::time::Duration> {
        self.input.total_duration()
    }
}
