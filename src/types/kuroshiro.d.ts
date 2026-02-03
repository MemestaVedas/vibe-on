declare module 'kuroshiro' {
    class Kuroshiro {
        init(analyzer: any): Promise<void>;
        convert(str: string, options: any): Promise<string>;
    }
    namespace Kuroshiro {
        const Util: any;
    }
    export default Kuroshiro;
}

declare module 'kuroshiro-analyzer-kuromoji' {
    export default class KuromojiAnalyzer {
        constructor(options: any);
    }
}
