import React, { useState } from "react";
import { User } from "firebase/auth";
import { LogOut, Calendar, User as UserIcon, AlertTriangle, X } from "lucide-react";

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onLogin: () => void;
  syncEnabled: boolean;
}

export default function Header({ user, onLogout, onLogin, syncEnabled }: HeaderProps) {
  const isLocalUser = user.uid === "local_single_user";
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  const handleCancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  return (
    <>
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo / Brand */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center font-black italic text-white text-sm select-none">
                TP
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white font-sans">
                  TaskPilot <span className="text-indigo-400">AI</span>
                </h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">YOUR DAY, AI OPTIMIZED</p>
              </div>
            </div>

            {/* User Profile & Actions */}
            <div className="flex items-center space-x-4">
              {syncEnabled ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-full border border-slate-800">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                  <span className="text-[11px] font-medium text-slate-400">Calendar Synced</span>
                </div>
              ) : (
                <button
                  onClick={onLogin}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-950/40 hover:bg-indigo-900 border border-indigo-900/40 rounded-full cursor-pointer text-[10px] font-semibold text-indigo-400 uppercase tracking-wider font-mono transition-all"
                  title="Connect Google Account to enable calendar sync"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                  <span>Connect Calendar</span>
                </button>
              )}

              <div className="flex items-center space-x-3 border-l border-slate-800 pl-4">
                <div className="flex items-center space-x-2">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "User"}
                      className="w-8 h-8 rounded-lg border border-slate-800 referrer-policy='no-referrer'"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-850 flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                  <div className="hidden md:block text-left">
                    <p className="text-xs font-semibold text-slate-200">{user.displayName || "Pilot"}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">YOU</p>
                  </div>
                </div>

                {!isLocalUser && (
                  <button
                    onClick={handleLogoutClick}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-all duration-200 cursor-pointer"
                    title="Disconnect Google Account"
                  >
                    <LogOut className="w-4.5 h-4.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 transition-all animate-fade-in">
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative overflow-hidden animate-scale-in space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Design Accents */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-indigo-500 to-indigo-600" />
            
            {/* Close Button */}
            <button
              onClick={handleCancelLogout}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-all p-1 hover:bg-slate-850 rounded-lg cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header / Icon */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono">
                  Confirm Sign Out
                </h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">TASKPILOT DISCONNECT</p>
              </div>
            </div>

            {/* Content description */}
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to sign out of your Google account? This will temporarily stop calendar synchronization until you sign back in.
            </p>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCancelLogout}
                className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 hover:border-slate-700 text-[10px] font-bold py-2.5 rounded-xl uppercase tracking-wider transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLogout}
                className="flex-1 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-[10px] py-2.5 rounded-xl uppercase tracking-wider transition-all duration-200 shadow-lg shadow-rose-950/20 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
