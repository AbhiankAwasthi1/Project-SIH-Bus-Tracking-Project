import { Link } from "react-router-dom";
import { EmptyState } from "../../components/ui";

export function NotFoundPage() {
  return (
    <div className="page-center">
      <EmptyState title="Page not found">
        That route does not exist in the Drishti console. <Link to="/">Return to the map</Link>.
      </EmptyState>
    </div>
  );
}
