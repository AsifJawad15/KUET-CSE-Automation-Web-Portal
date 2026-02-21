// ==========================================
// Access Restricted Component
// Single Responsibility: Displays a permission-denied message
// DRY: Reused for any admin-only page guard
// ==========================================

import React from 'react';

interface AccessRestrictedProps {
  /** Which role is required (displayed in the message). */
  requiredRole?: string;
  /** Custom message override. */
  message?: string;
}

const AccessRestricted: React.FC<AccessRestrictedProps> = ({
  requiredRole = 'administrators',
  message,
}) => (
  <div className="bg-white dark:bg-[#161a1d] rounded-2xl shadow-lg p-8 border border-[#DCC5B2] dark:border-[#3d4951] text-center">
    <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-4">
      <svg
        className="w-8 h-8 text-red-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    </div>
    <h2 className="text-xl font-bold text-[#2C1810] dark:text-white mb-2">Access Restricted</h2>
    <p className="text-[#6B5744] dark:text-[#b1a7a6]">
      {message || `This section is only accessible to ${requiredRole}.`}
    </p>
  </div>
);

export default AccessRestricted;
