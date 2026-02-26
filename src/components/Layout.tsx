import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Upload, FileText, Navigation, Menu, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <Activity className="w-5 h-5" /> },
    { name: 'Upload', path: '/upload', icon: <Upload className="w-5 h-5" /> },
    { name: 'Review', path: '/review', icon: <FileText className="w-5 h-5" /> },
    { name: 'Navigator', path: '/navigator', icon: <Navigation className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-primary/30 selection:text-primary-light relative overflow-hidden">
      
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] opacity-20 animate-pulse-glow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-accent/5 rounded-full blur-[100px] opacity-20 animate-float" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/5 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="relative w-8 h-8 flex items-center justify-center bg-gradient-to-br from-primary to-accent rounded-lg shadow-[0_0_15px_rgba(0,255,148,0.3)] group-hover:shadow-[0_0_25px_rgba(0,255,148,0.5)] transition-shadow duration-300">
                <Activity className="w-5 h-5 text-black" />
              </div>
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 group-hover:to-white transition-all duration-300">
                Nutri<span className="text-primary font-light">Flow</span> Agent
              </span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 group",
                      isActive ? "text-primary bg-white/5 shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]" : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {isActive && (
                      <div
                        className="absolute inset-0 bg-primary/10 rounded-lg border border-primary/20 animate-in fade-in zoom-in-95"
                      />
                    )}
                    <span className="relative z-10 group-hover:scale-105 transition-transform duration-200">{item.icon}</span>
                    <span className="relative z-10">{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div
            className="md:hidden glass-panel border-t border-white/5 animate-in slide-in-from-top-2"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "block px-3 py-2 rounded-md text-base font-medium flex items-center gap-3 transition-colors",
                    location.pathname === item.path ? "text-primary bg-white/5 border border-primary/20" : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {item.icon}
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="relative z-10 pt-24 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-4rem)]">
        <div
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          {children}
        </div>
      </main>

    </div>
  );
};
