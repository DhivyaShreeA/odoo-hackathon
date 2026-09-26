import { getUser } from "../lib/api.js";

export default function Profile() {
  const user = getUser();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">My Profile</h1>
        <p className="text-sm text-muted mt-1">Your account details</p>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 max-w-md">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-xl font-semibold">
            {user?.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="font-semibold text-ink">{user?.name}</p>
            <p className="text-sm text-muted">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
