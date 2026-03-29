import type { ReactNode } from 'react';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="login">
      <div className="login__brand" aria-hidden="true">
        <div className="login__brandInner">
          <div className="login__logoMark">D</div>
          <h1 className="login__brandTitle">DukaanPro</h1>
          <p className="login__brandTagline">Your shop, streamlined — inventory, orders, and customers in one place.</p>
          <ul className="login__brandBullets">
            <li>Built for busy store owners</li>
            <li>Works on phone and desktop</li>
            <li>Aligned with the DukaanPro API</li>
          </ul>
        </div>
      </div>

      <div className="login__panel">
        <div className="login__panelInner">
          <header className="login__header">
            <div className="login__logoRow">
              <span className="login__logoMark login__logoMark--sm" aria-hidden="true">
                D
              </span>
              <span className="login__logoText">DukaanPro</span>
            </div>
            <h2 className="login__title">{title}</h2>
            <p className="login__subtitle">{subtitle}</p>
          </header>

          {children}

          {footer ? <footer className="login__footer">{footer}</footer> : null}
        </div>
      </div>
    </div>
  );
}
