import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CITIES, DEFAULT_CITY, type City, type CityId } from "../cities";

/** Non-sensitive UI preference, kept separate from the session key. */
const CITY_KEY = "drishti.city";

function isCityId(value: unknown): value is CityId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CITIES, value);
}

function readStoredCity(): CityId {
  try {
    const stored = window.localStorage.getItem(CITY_KEY);
    return isCityId(stored) ? stored : DEFAULT_CITY;
  } catch {
    return DEFAULT_CITY;
  }
}

type CityContextValue = {
  cityId: CityId;
  city: City;
  setCityId: (next: CityId) => void;
};

const CityContext = createContext<CityContextValue | null>(null);

/**
 * The selected city scopes everything the operator sees, so it is genuinely
 * global. It lives in a context of its own rather than alongside fleet data so
 * that changing city does not invalidate consumers of the live feed.
 */
export function CityProvider({ children }: { children: ReactNode }) {
  const [cityId, setCityIdState] = useState<CityId>(readStoredCity);

  const setCityId = useCallback((next: CityId) => {
    setCityIdState(next);
    try {
      window.localStorage.setItem(CITY_KEY, next);
    } catch {
      /* Preference is best-effort. */
    }
  }, []);

  const value = useMemo<CityContextValue>(
    () => ({ cityId, city: CITIES[cityId], setCityId }),
    [cityId, setCityId],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity(): CityContextValue {
  const value = useContext(CityContext);
  if (!value) {
    throw new Error("useCity must be used inside <CityProvider>.");
  }
  return value;
}
