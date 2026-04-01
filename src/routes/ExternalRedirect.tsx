import { useEffect } from 'react';

type ExternalRedirectProps = {
  href: string;
};

/** Full-page navigation to another origin (split customer / business subdomains). */
export function ExternalRedirect({ href }: ExternalRedirectProps) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);
  return (
    <div className="authWait">
      <div className="authWait__card" role="status" aria-live="polite">
        <div className="authWait__spinner" aria-hidden="true" />
        <p className="authWait__title">Opening the right app…</p>
      </div>
    </div>
  );
}
