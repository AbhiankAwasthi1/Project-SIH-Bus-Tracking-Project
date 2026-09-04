import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { CITIES, type CityId } from "../../cities";
import { useCity } from "../../state/CityContext";
import { Button, SelectField } from "../ui";
import { ConnectionBadge } from "./ConnectionBadge";

const CITY_OPTIONS = Object.values(CITIES).map((city) => ({
  value: city.id,
  label: city.label,
}));

const NAV_ITEMS = [
  { to: "/", label: "Map", end: true },
  { to: "/simulate", label: "Simulator", end: false },
];

export function TopBar() {
  const { city, cityId, setCityId } = useCity();
  const { session, signOut } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <strong>Drishti</strong>
        <span>SIH26124 &middot; {city.label} fleet</span>
      </div>

      <nav className="topbar__nav" aria-label="Main">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? "nav-link is-active" : "nav-link")}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="topbar__actions">
        <ConnectionBadge />

        <div className="topbar__city">
          <SelectField<CityId>
            label="City"
            labelHidden
            value={cityId}
            options={CITY_OPTIONS}
            onValueChange={setCityId}
          />
        </div>

        {session ? (
          <div className="topbar__user">
            <b className="truncate">{session.email}</b>
            <span>{session.role}</span>
          </div>
        ) : null}

        <Button variant="ghost" size="sm" onClick={() => signOut("user")}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
