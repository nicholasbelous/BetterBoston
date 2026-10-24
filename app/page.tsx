// Home page: address search + "use my location".
// On success, navigate to /report?lat=..&lng=..&q=<label>.
import AddressSearch from "@/components/AddressSearch";

export default function HomePage() {
  // TODO (task 1.4): short pitch, AddressSearch, 2-3 preloaded demo address
  // buttons (task 7.3), and a line saying coverage is Boston demo areas only.
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">How hot and green is your block?</h1>
      <p>
        Type a Boston address to see a climate report for your block, made from satellite and
        aerial photos.
      </p>
      <AddressSearch />
    </div>
  );
}
