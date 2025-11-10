import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { TripMember } from "../types";

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
}

const SettlementForm = ({ members, currency, onSubmit, isSubmitting, currentUserId }: SettlementFormProps) => {
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
        <label>Amount ({currency})</label>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>

      <div className="input-group">
        <label>Note (optional)</label>
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Dinner reimbursement" />
      </div>

      {error && <p style={{ color: "#fda4af" }}>{error}</p>}

      <button type="submit" className="secondary" disabled={isSubmitting}>
        {isSubmitting ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
};

export default SettlementForm;
