/**
 * Utility functions for location data
 */

/**
 * Extracts a city name from a full address string.
 * BTCMap addresses come in various formats:
 * - "123 Main St, Austin, TX 78701" (comma-separated)
 * - "456 Oak Ave, San Francisco, CA 94102"
 * - "18644 RM 1431 Jonestown 78645" (space-separated, no commas)
 * - "789 Broadway, New York, NY"
 *
 * This function attempts to extract the city portion.
 * Falls back to the full address if parsing fails.
 */
export function parseCityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;

  // Split by comma and trim each part
  const parts = address.split(',').map(p => p.trim());

  if (parts.length < 2) {
    // No commas - try to parse space-separated format
    // Common format: "Street Number Street Name City ZIP"
    // Example: "18644 RM 1431 Jonestown 78645"

    const words = address.trim().split(/\s+/);

    // Look for a 5-digit ZIP code at the end
    const lastWord = words[words.length - 1];
    if (/^\d{5}(-\d{4})?$/.test(lastWord) && words.length >= 3) {
      // Last word is a ZIP code
      // The city is likely the word before the ZIP
      // But we need to skip street numbers and road names

      // Try to find the city by looking for the word before ZIP
      // that isn't a road type (Rd, St, Ave, etc.) or a number
      const roadTypes = ['rd', 'st', 'ave', 'blvd', 'dr', 'ln', 'ct', 'way', 'pl', 'rm', 'hwy', 'fm'];

      // Start from the word before ZIP and work backwards
      for (let i = words.length - 2; i >= 0; i--) {
        const word = words[i];
        const lowerWord = word.toLowerCase();

        // Skip if it's a number or road type
        if (/^\d+$/.test(word) || roadTypes.includes(lowerWord)) {
          continue;
        }

        // This is likely the city name
        // Check if there might be a multi-word city (e.g., "New York")
        // For now, just return the single word
        return word;
      }
    }

    // If no ZIP found or parsing failed, return the original address
    return address;
  }

  if (parts.length === 2) {
    // Format: "Street, City" or "City, State"
    // Return the second part if it looks like a state/zip, otherwise return the first
    const second = parts[1];
    // Check if it looks like "State ZIP" or just state abbreviation
    if (/^[A-Z]{2}\s*\d{5}/.test(second) || /^[A-Z]{2}$/.test(second)) {
      // Second part is state/zip, first part might be city
      return parts[0];
    }
    // Otherwise return second part as city
    return second;
  }

  // 3+ parts: typically "Street, City, State ZIP"
  // The city is usually the second-to-last part before state/zip
  const secondToLast = parts[parts.length - 2];
  const last = parts[parts.length - 1];

  // Check if last part looks like "State ZIP" or just state
  if (/^[A-Z]{2}\s*\d{5}/.test(last) || /^[A-Z]{2}$/.test(last) || /^\d{5}/.test(last)) {
    // Last is state/zip, second-to-last is likely the city
    return secondToLast;
  }

  // For other formats, try to find a city-like segment
  // Skip the first part (usually street address) and return the second
  return parts[1];
}

/**
 * Gets the display label for a location (city or parsed from address).
 * Prefers address if available (from BTCMap), falls back to city field.
 */
export function getLocationLabel(location: { address?: string | null; city?: string | null }): string | null {
  if (location.address) {
    return parseCityFromAddress(location.address);
  }
  return location.city || null;
}
