/**
 * layout.tsx — root layout: global metadata, JSON-LD (Organization +
 * SoftwareApplication), skip link, sticky navbar and footer.
 */
import type { Metadata } from "next"
import "./globals.css"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { SITE } from "@/lib/site"
import { SITE_METADATA, buildMetadata, organizationJsonLd, softwareApplicationJsonLd, jsonLdScript } from "@/lib/seo"

export const metadata: Metadata = {
  ...SITE_METADATA,
  ...buildMetadata({
    title: "ChatriX — Your AI Moderator for Your Facebook Page",
    description: SITE.description,
    path: "/",
  }),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(organizationJsonLd())} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(softwareApplicationJsonLd())} />
        <Navbar />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
