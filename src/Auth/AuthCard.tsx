"use client";

import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import SignIn from './SignIn';
import SignUp from './SignUp';

export default function AuthCard() {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-[#f6f7fb]">
      <div className="w-full max-w-4xl">
        {/* Desktop Layout */}
        <div className="hidden lg:flex bg-white rounded-lg shadow-xl shadow-gray-200/60 overflow-hidden min-h-[540px] border border-gray-200">
          {/* Form Side */}
          <div className="flex-1 flex items-center justify-center p-10">
            {isSignUp ? (
              <SignUp onToggleForm={() => setIsSignUp(false)} />
            ) : (
              <SignIn onToggleForm={() => setIsSignUp(true)} />
            )}
          </div>

          <div className="flex-1 bg-gray-950 flex items-center justify-center p-10">
            <div className="text-center text-white space-y-5">
              <div className="w-20 h-20 mx-auto bg-white rounded-lg flex items-center justify-center">
                <img src="/kuet-logo.png" alt="KUET" className="h-14 w-14 object-contain" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white">
                  KUET CSE
                </h2>
                <p className="text-sm text-gray-300 mt-1">Automation Portal</p>
              </div>

              <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">
                Department of Computer Science and Engineering — Khulna University of Engineering & Technology
              </p>

              <div className="mx-auto inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-gray-200">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Admin, Head, and Teacher Access
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          <div className="bg-gray-950 p-6 text-center text-white">
            <div className="w-14 h-14 mx-auto bg-white rounded-lg flex items-center justify-center mb-3">
              <img src="/kuet-logo.png" alt="KUET" className="h-10 w-10 object-contain" />
            </div>
            <h2 className="text-xl font-bold">KUET CSE Portal</h2>
            <p className="text-xs text-gray-400 mt-1">Admin, Head, and Teacher Access</p>
          </div>
          
          <div className="p-6">
            {isSignUp ? (
              <SignUp onToggleForm={() => setIsSignUp(false)} />
            ) : (
              <SignIn onToggleForm={() => setIsSignUp(true)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
