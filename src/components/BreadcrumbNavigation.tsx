import { useLocation, Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home, ChevronRight } from "lucide-react";

interface BreadcrumbConfig {
  [key: string]: {
    label: string;
    parent?: string;
  };
}

const breadcrumbConfig: BreadcrumbConfig = {
  "/": { label: "Home" },
  "/admin": { label: "Admin", parent: "/" },
  "/admin/dashboard": { label: "Dashboard", parent: "/admin" },
  "/admin/login": { label: "Login", parent: "/" },
  "/setup": { label: "Setup", parent: "/" },
  "/kiosk": { label: "Kiosk", parent: "/" },
  "/kiosk/register": { label: "Register Device", parent: "/kiosk" },
};

const getTabFromHash = (hash: string) => {
  const tabMap: { [key: string]: string } = {
    "#employees": "Employees",
    "#locations": "Locations", 
    "#devices": "Devices",
    "#reports": "Reports",
    "#admin": "Settings",
    "#notifications": "Notifications",
    "#alerts": "Alerts",
  };
  return tabMap[hash] || null;
};

const BreadcrumbNavigation = () => {
  const location = useLocation();
  const pathname = location.pathname;
  const hash = location.hash;

  const getBreadcrumbs = () => {
    const crumbs = [];
    let currentPath = pathname;
    
    // Build breadcrumb trail
    while (currentPath && breadcrumbConfig[currentPath]) {
      const config = breadcrumbConfig[currentPath];
      crumbs.unshift({
        path: currentPath,
        label: config.label,
      });
      currentPath = config.parent || "";
    }

    // Add tab-specific breadcrumb if on admin dashboard
    if (pathname === "/admin/dashboard" && hash) {
      const tabLabel = getTabFromHash(hash);
      if (tabLabel) {
        crumbs.push({
          path: `${pathname}${hash}`,
          label: tabLabel,
        });
      }
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <div className="container mx-auto px-3 lg:px-6 py-2 border-b border-border/30 bg-background/50 backdrop-blur-sm">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.path} className="flex items-center">
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {index === breadcrumbs.length - 1 ? (
                  <BreadcrumbPage className="flex items-center gap-1.5">
                    {index === 0 && <Home className="h-4 w-4" />}
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link 
                      to={crumb.path} 
                      className="flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      {index === 0 && <Home className="h-4 w-4" />}
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};

export default BreadcrumbNavigation;