'use client';

import { useState } from 'react';
import type { SessionUser } from '@sheri-gold/contracts';

export function UserAvatar({ user }: { user: SessionUser }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials =
    user.fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('') || '؟';
  return (
    <span
      className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--teal-100)] text-sm font-semibold text-[var(--foreground)]"
      aria-hidden="true"
    >
      {user.avatarUrl && failedUrl !== user.avatarUrl ? (
        // Avatar URLs are supplied by the authenticated profile API and may be on an external host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt=""
          className="size-full object-cover"
          onError={() => setFailedUrl(user.avatarUrl ?? null)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
