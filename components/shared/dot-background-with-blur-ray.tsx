export const DotBackgroundWithBlurRay = () => (
  <div
    className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
    style={{
      backgroundImage: "radial-gradient(#80808012 1px, transparent 1px)",
      backgroundSize: "24px 24px",
    }}
  >
    {/* 右上光暈 */}
    <div
      className="
        absolute -top-[10%] -right-[5%] 
        w-[min(80vw,600px)] h-[min(80vw,600px)]
        bg-purple-500/10 dark:bg-purple-500/20 
        rounded-full blur-[8vw] md:blur-[100px]
        pointer-events-none mix-blend-multiply dark:mix-blend-screen
      "
    />

    {/* 左下光暈 */}
    <div
      className="
        absolute bottom-[15%] -left-[10%] 
        w-[min(70vw,500px)] h-[min(70vw,500px)]
        bg-blue-500/10 dark:bg-blue-500/20 
        rounded-full blur-[7vw] md:blur-[120px]
        pointer-events-none mix-blend-multiply dark:mix-blend-screen
      "
    />
  </div>
);