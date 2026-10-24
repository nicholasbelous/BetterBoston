"use client";
// Address input + "Use my location" button.
// Address -> GET /api/geocode?q= -> router.push(/report?lat&lng&q)
// Location -> navigator.geolocation.getCurrentPosition -> same push, q="My location"

import { useState } from "react";

export default function AddressSearch() {
  const [query, setQuery] = useState("");

  // TODO (task 1.4): submit handler, loading + error states
  // ("We couldn't find that address. Try adding the city."),
  // geolocation handler with a friendly message if permission is denied.
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="address" className="font-medium">
        Address
      </label>
      <input
        id="address"
        type="text"
        inputMode="search"
        autoComplete="street-address"
        placeholder="e.g. 1 City Hall Sq, Boston"
        className="border rounded-lg px-3 py-3 text-base"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="submit" className="rounded-lg px-4 py-3 bg-black text-white font-medium">
        See my report
      </button>
      <button type="button" className="rounded-lg px-4 py-3 border font-medium">
        Use my location
      </button>
    </form>
  );
}
