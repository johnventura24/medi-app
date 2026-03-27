export default function TPMODisclaimer() {
  return (
    <div className="border-t bg-gray-50 dark:bg-gray-900 px-4 py-3 text-center">
      <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl mx-auto">
        We do not offer every plan available in your area. Currently we represent
        organizations which offer products in your area. Please contact{" "}
        <a
          href="https://www.medicare.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Medicare.gov
        </a>
        , 1-800-MEDICARE, or your local State Health Insurance Assistance Program
        (SHIP) to get information on all of your options.
      </p>
    </div>
  );
}
