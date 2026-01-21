import { getCurrentWindow } from '@tauri-apps/api/window';


export function TitleBar() {
    const appWindow = getCurrentWindow();

    return (
        <div className="fixed top-0 right-0 z-[5000] pt-5 pr-6 pointer-events-none">
            <div className="flex gap-2 pointer-events-auto">
                {/* Minimize - Yellow */}
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E] border border-[#D89E24]/50 flex justify-center items-center cursor-pointer relative overflow-hidden group active:brightness-75 shadow-sm" onClick={() => appWindow.minimize()}>
                    <svg viewBox="0 0 10 10" className="w-[6px] h-[6px] opacity-0 group-hover:opacity-100 text-black/60 transition-opacity duration-200"><path d="M2,5 L8,5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </div>
                {/* Maximize - Green */}
                <div className="w-3 h-3 rounded-full bg-[#28C840] border border-[#1AAB29]/50 flex justify-center items-center cursor-pointer relative overflow-hidden group active:brightness-75 shadow-sm" onClick={() => appWindow.toggleMaximize()}>
                    <svg viewBox="0 0 10 10" className="w-[6px] h-[6px] opacity-0 group-hover:opacity-100 text-black/60 transition-opacity duration-200"><path d="M2,2 L2,8 L8,8 L8,2 L2,2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </div>
                {/* Close - Red */}
                <div className="w-3 h-3 rounded-full bg-[#FF5F57] border border-[#E0443E]/50 flex justify-center items-center cursor-pointer relative overflow-hidden group active:brightness-75 shadow-sm" onClick={() => appWindow.close()}>
                    <svg viewBox="0 0 10 10" className="w-[6px] h-[6px] opacity-0 group-hover:opacity-100 text-black/60 transition-opacity duration-200"><path d="M2,2 L8,8 M8,2 L2,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </div>
            </div>
        </div>
    );
}
