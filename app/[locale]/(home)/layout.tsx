'use client';
export default function HomeLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="h-screen w-full overflow-y-auto overflow-x-hidden bg-background">
            {children}
        </div>
    );
}
