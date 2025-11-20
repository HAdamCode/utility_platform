import { FormEvent, WheelEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { PaymentMethods, TripMember } from "../types";

interface SettlementFormProps {
  members: TripMember[];
  currency: string;
  onSubmit: (payload: {
    fromMemberId: string;
    toMemberId: string;
    amount: number;
    note?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
  currentUserId?: string;
  paymentMethods?: Record<string, PaymentMethods>;
}

const SettlementForm = ({
  members,
  currency,
  onSubmit,
  isSubmitting,
  currentUserId,
  paymentMethods
}: SettlementFormProps) => {
  const preferredFromMember = useMemo(() => {
    if (currentUserId && members.some((member) => member.memberId === currentUserId)) {
      return currentUserId;
    }
    return members[0]?.memberId ?? "";
  }, [currentUserId, members]);

  const pickAlternateMemberId = useCallback(
    (excludeId: string): string => {
      const alternate = members.find((member) => member.memberId !== excludeId);
      return alternate?.memberId ?? excludeId ?? "";
    },
    [members]
  );

  const [fromMemberId, setFromMemberId] = useState<string>(preferredFromMember);
  const [fromManuallySelected, setFromManuallySelected] = useState(false);
  const [toMemberId, setToMemberId] = useState<string>(pickAlternateMemberId(preferredFromMember));
  const [toManuallySelected, setToManuallySelected] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFromMemberId((previous) => {
      if (fromManuallySelected && members.some((member) => member.memberId === previous)) {
        return previous;
      }
      if (members.some((member) => member.memberId === previous)) {
        return previous;
      }
      setFromManuallySelected(false);
      return preferredFromMember;
    });
  }, [members, preferredFromMember, fromManuallySelected]);

  useEffect(() => {
    setToMemberId((previous) => {
      const exists = members.some((member) => member.memberId === previous);
      if (toManuallySelected && exists && previous !== fromMemberId) {
        return previous;
      }
      const alternate = pickAlternateMemberId(fromMemberId);
      if (!exists || previous === fromMemberId) {
        setToManuallySelected(false);
        return alternate;
      }
      if (!toManuallySelected) {
        return alternate;
      }
      return previous;
    });
  }, [members, fromMemberId, toManuallySelected, pickAlternateMemberId]);

  useEffect(() => {
    if (!fromManuallySelected) {
      setFromMemberId(preferredFromMember);
    }
  }, [preferredFromMember, fromManuallySelected]);

  const handleNumberInputWheel = useCallback((event: WheelEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.blur();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!fromMemberId || !toMemberId) {
      setError("Select both members");
      return;
    }
    if (fromMemberId === toMemberId) {
      setError("Members must be different");
      return;
    }
    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    await onSubmit({
      fromMemberId,
      toMemberId,
      amount: parsedAmount,
      note: note.trim() || undefined
    });

    setAmount("");
    setNote("");
    setFromMemberId(preferredFromMember);
    setFromManuallySelected(false);
    const fallbackTo = pickAlternateMemberId(preferredFromMember);
    setToMemberId(fallbackTo);
    setToManuallySelected(false);
  };

  const handleFromChange = (value: string) => {
    setFromMemberId(value);
    setFromManuallySelected(true);
    if (!toManuallySelected || value === toMemberId) {
      const alternate = pickAlternateMemberId(value);
      setToMemberId(alternate);
      setToManuallySelected(false);
    }
  };

  const handleToChange = (value: string) => {
    setToMemberId(value);
    setToManuallySelected(true);
  };

  const payeeMethods = paymentMethods?.[toMemberId];
  const availableMethodEntries = useMemo(() => {
    if (!payeeMethods) return [];
    return Object.entries(payeeMethods).filter(([, value]) => Boolean(value)) as Array<
      [keyof PaymentMethods, string]
    >;
  }, [payeeMethods]);

  return (
    <form onSubmit={handleSubmit} className="list">
      <div className="input-group">
        <label>From</label>
        <select value={fromMemberId} onChange={(event) => handleFromChange(event.target.value)}>
          {members.map((member) => (
            <option key={member.memberId} value={member.memberId}>
              {member.displayName}
              {currentUserId === member.memberId ? " (you)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label>To</label>
        <select value={toMemberId} onChange={(event) => handleToChange(event.target.value)}>
          {members.map((member) => (
            <option key={member.memberId} value={member.memberId}>
              {member.displayName}
              {currentUserId === member.memberId ? " (you)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label>Amount</label>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          onWheel={handleNumberInputWheel}
        />
      </div>

      <div className="input-group">
        <label>Note (optional)</label>
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Dinner reimbursement" />
      </div>

      {availableMethodEntries.length > 0 ? (
        <div className="card" style={{ padding: "0.75rem", background: "rgba(15,23,42,0.35)", border: "1px solid rgba(148,163,184,0.1)" }}>
          <p style={{ margin: "0 0 0.25rem", fontWeight: 600 }}>Pay {members.find((m) => m.memberId === toMemberId)?.displayName ?? "member"} via:</p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#e2e8f0" }}>
            {availableMethodEntries.map(([method, value]) => (
              <li key={method} style={{ margin: "0.15rem 0" }}>
                <strong style={{ textTransform: "capitalize" }}>{method}:</strong> {value}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          No payment methods saved for the recipient yet.
        </p>
      )}

      {error && <p style={{ color: "#fda4af" }}>{error}</p>}

      <button type="submit" className="secondary" disabled={isSubmitting}>
        {isSubmitting ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
};

export default SettlementForm;
