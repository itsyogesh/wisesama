import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-wisesama-dark">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-wisesama-purple to-wisesama-purple-light" />
              <span className="font-heading text-xl font-semibold">Wisesama</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Protecting the Polkadot ecosystem from fraud, phishing, and scams.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/check"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Check Entity
                </Link>
              </li>
              <li>
                <Link
                  href="/report"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Report Fraud
                </Link>
              </li>
              <li>
                <Link
                  href="/docs"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  API Documentation
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/about"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  About Us
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/itsyogesh/wisesama"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://polkadot.js.org/phishing/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Phishing Database
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/40">
          <p className="text-sm text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} Wisesama. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
