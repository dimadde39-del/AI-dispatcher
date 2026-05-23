import { PageHeader } from "@/components/admin/PageHeader";
import { createMasterAction } from "../actions";

export default function NewMasterPage() {
  return (
    <>
      <PageHeader
        title="New master"
        description="Create the core master record and default assistant profile."
      />
      <form className="card form" action={createMasterAction}>
        <div className="form-row">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" required placeholder="Azamat" />
        </div>
        <div className="form-row">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" required placeholder="+77001234567" />
        </div>
        <div className="form-row">
          <label htmlFor="city">City</label>
          <input id="city" name="city" defaultValue="Almaty" required />
        </div>
        <div className="form-row">
          <label htmlFor="tradeType">Trade type</label>
          <select id="tradeType" name="tradeType" required defaultValue="PLUMBING">
            <option value="PLUMBING">Plumbing</option>
            <option value="WASHING_MACHINE_REPAIR">Washing machine repair</option>
            <option value="FRIDGE_REPAIR">Fridge repair</option>
            <option value="ELECTRICIAN">Electrician</option>
            <option value="LOCKSMITH">Locksmith</option>
            <option value="CONDITIONER">Conditioner</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="telegramChatId">Telegram chat ID</label>
          <input id="telegramChatId" name="telegramChatId" placeholder="Optional" />
        </div>
        <label className="actions">
          <input name="createTrialSubscription" type="checkbox" style={{ width: "auto" }} />
          Create trial subscription
        </label>
        <div className="actions">
          <button type="submit">Create master</button>
        </div>
      </form>
    </>
  );
}
