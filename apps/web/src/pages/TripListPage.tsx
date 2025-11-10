import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, searchUsers as searchUsersRequest } from "../lib/api";
import type { Trip, TripListResponse, UserProfile } from "../types";

interface FormState {
  name: string;
  startDate?: string;
  endDate?: string;
}

const defaultFormState: FormState = {
  name: "",
  startDate: "",
  endDate: ""
};

const TripListPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [error, setError] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: () => api.get<TripListResponse>("/trips")
  });

  const trips = useMemo(() => data?.trips ?? [], [data]);

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => api.post<Trip>("/trips", payload),
    onSuccess: (trip) => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      navigate(`/group-expenses/trips/${trip.tripId}`);
      setForm(defaultFormState);
      setSelectedMembers([]);
      setSearchResults([]);
      setSearchTerm("");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to create trip");
      }
    }
  });

  const searchMutation = useMutation({
    mutationFn: (query: string) => searchUsersRequest(query),
    onSuccess: (data) => {
      setSearchResults(data.users);
      setSearchMessage(
        data.users.length ? null : "No people found with that email prefix"
      );
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setSearchMessage(err.message);
      } else {
        setSearchMessage("Unable to search users");
      }
    }
  });

  const runSearch = () => {
    setSearchMessage(null);
    if (!searchTerm.trim()) {
      setSearchMessage("Enter at least one character to search");
      return;
    }
    searchMutation.mutate(searchTerm.trim());
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Trip name is required");
      return;
    }

    createMutation.mutate({
      name: form.name.trim(),
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      currency: "USD",
      members: selectedMembers.map((member) => ({ userId: member.userId }))
    });
  };

  const addSelectedMember = (profile: UserProfile) => {
    setSelectedMembers((prev) => {
      if (prev.some((member) => member.userId === profile.userId)) {
        return prev;
      }
      return [...prev, profile];
    });
  };

  const removeSelectedMember = (userId: string) => {
    setSelectedMembers((prev) => prev.filter((member) => member.userId !== userId));
  };

  return (
    <div className="grid-two">
      <section className="card">
        <div className="section-title">
          <h2>Your Trips</h2>
          <span className="muted">{trips.length} active</span>
        </div>
        {isLoading ? (
          <p className="muted">Loading trips…</p>
        ) : trips.length === 0 ? (
          <p className="muted">No trips yet. Create one to get started.</p>
        ) : (
          <div className="list">
            {trips.map((trip) => (
              <Link
                key={trip.tripId}
                to={`/group-expenses/trips/${trip.tripId}`}
                className="card"
                style={{ textDecoration: "none" }}
              >
                <h3 style={{ marginTop: 0 }}>{trip.name}</h3>
                <p className="muted" style={{ margin: "0.25rem 0" }}>
                  {trip.startDate ? `${trip.startDate}` : "Flexible dates"}
                  {trip.endDate ? ` → ${trip.endDate}` : ""}
                </p>
                <div className="pill">Currency • {trip.currency}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Create Trip</h2>
        </div>
        <form onSubmit={handleSubmit} className="list">
          <div className="input-group">
            <label htmlFor="trip-name">Trip name</label>
            <input
              id="trip-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Nashville Tour 2024"
            />
          </div>

          <div className="input-group">
            <label>Dates (optional)</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
              />
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Invite people (optional)</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by email"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    runSearch();
                  }
                }}
              />
              <button type="button" className="secondary" disabled={searchMutation.isPending} onClick={runSearch}>
                {searchMutation.isPending ? "Searching…" : "Search"}
              </button>
            </div>
            {searchMessage && <p className="muted">{searchMessage}</p>}
            {searchResults.length > 0 && (
              <div className="list">
                {searchResults.map((user) => (
                  <div key={user.userId} className="card" style={{ padding: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{user.displayName ?? user.email ?? "Unnamed"}</strong>
                        {user.email && (
                          <p className="muted" style={{ margin: "0.2rem 0 0" }}>
                            {user.email}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => addSelectedMember(user)}
                        disabled={selectedMembers.some((member) => member.userId === user.userId)}
                      >
                        {selectedMembers.some((member) => member.userId === user.userId)
                          ? "Added"
                          : "Add"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedMembers.length > 0 && (
              <div className="list">
                <p className="muted" style={{ marginBottom: 0 }}>
                  Selected people
                </p>
                {selectedMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="card"
                    style={{ padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <div>
                      <strong>{member.displayName ?? member.email ?? member.userId}</strong>
                      {member.email && (
                        <p className="muted" style={{ margin: "0.2rem 0 0" }}>
                          {member.email}
                        </p>
                      )}
                    </div>
                    <button type="button" className="secondary" onClick={() => removeSelectedMember(member.userId)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p style={{ color: "#fda4af" }}>{error}</p>}

          <button type="submit" className="primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create trip"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default TripListPage;
