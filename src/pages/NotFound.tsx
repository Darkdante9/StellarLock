import { Link, useLocation } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import { Trans, useTranslation } from "react-i18next"
import { AlertCircle, Home, Search, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/Button"

export function NotFound() {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <div>
      <Helmet>
        <title>Page Not Found — StellarLock</title>
        <meta name="description" content="The page you're looking for doesn't exist." />
      </Helmet>

      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="mx-auto max-w-lg text-center">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
          </div>

          {/* Heading */}
          <h1 className="text-4xl font-bold">404</h1>
          <h2 className="mt-2 text-2xl font-semibold">{t("notfound.title", "Page Not Found")}</h2>

          {/* Description */}
          <p className="mt-3 text-muted-foreground">
            <Trans i18nKey="notfound.description">
              The page you're looking for doesn't exist or may have been moved.
            </Trans>
          </p>

          {/* Attempted path info */}
          {location.pathname !== "/" && (
            <div className="mt-4 rounded-lg border border-border bg-card/50 p-3">
              <p className="text-xs font-mono text-muted-foreground">{location.pathname}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to="/">
              <Button variant="primary" size="lg">
                <Home className="h-4 w-4" />
                {t("notfound.goHome", "Back to Home")}
              </Button>
            </Link>
            <Link to="/explore">
              <Button variant="outline" size="lg">
                <Search className="h-4 w-4" />
                {t("notfound.explore", "Explore Locks")}
              </Button>
            </Link>
          </div>

          {/* Additional help */}
          <div className="mt-8 rounded-lg border border-border bg-card p-4 text-left">
            <div className="flex gap-3">
              <HelpCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">{t("notfound.helpTitle", "Need Help?")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  <Trans
                    i18nKey="notfound.helpDesc"
                    components={{
                      explorer: <Link to="/explore" className="text-primary hover:underline" />,
                      github: (
                        <a href="https://github.com/StellarLock/StellarLock" className="text-primary hover:underline" />
                      ),
                    }}
                  />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
