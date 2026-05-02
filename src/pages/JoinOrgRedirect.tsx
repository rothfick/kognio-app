import { Navigate, useParams } from "react-router-dom";

/**
 * /join-org/:code is an alias for the existing /org/invite/:token flow.
 * `:code` is mapped to `organization_invites.token` for backward compatibility
 * with existing pending invite links.
 */
export default function JoinOrgRedirect() {
  const { code } = useParams<{ code: string }>();
  if (!code) return <Navigate to="/" replace />;
  return <Navigate to={`/org/invite/${code}`} replace />;
}
