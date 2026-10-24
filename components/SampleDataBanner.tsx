// Banner shown on every page that displays scores while metadata.is_sample is true.
// Sample data must never look like real results.

export default function SampleDataBanner({ show = true }: { show?: boolean }) {
  // TODO (task 1.5): pass show={metadata.is_sample} from the report page.
  if (!show) return null;
  return (
    <div role="status" className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold">
      SAMPLE DATA: these scores are made up for testing. They are not real results.
    </div>
  );
}
