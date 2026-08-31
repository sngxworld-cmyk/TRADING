import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Phone, Check } from "lucide-react";

export interface CountryInfo {
  code: string; // ISO 2-letter
  name: string;
  dialCode: string;
  flag: string;
  format?: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸", format: "(555) 000-0000" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧", format: "7911 123456" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦", format: "(555) 000-0000" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺", format: "412 345 678" },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳", format: "98765 43210" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬", format: "8123 4567" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪", format: "50 123 4567" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦", format: "50 123 4567" },
  { code: "QA", name: "Qatar", dialCode: "+974", flag: "🇶🇦", format: "3312 3456" },
  { code: "KW", name: "Kuwait", dialCode: "+965", flag: "🇰🇼", format: "5123 4567" },
  { code: "BH", name: "Bahrain", dialCode: "+973", flag: "🇧🇭", format: "3612 3456" },
  { code: "OM", name: "Oman", dialCode: "+968", flag: "🇴🇲", format: "9123 4567" },
  { code: "LK", name: "Sri Lanka", dialCode: "+94", flag: "🇱🇰", format: "71 234 5678" },
  { code: "PK", name: "Pakistan", dialCode: "+92", flag: "🇵🇰", format: "300 1234567" },
  { code: "BD", name: "Bangladesh", dialCode: "+880", flag: "🇧🇩", format: "1712 345678" },
  { code: "NP", name: "Nepal", dialCode: "+977", flag: "🇳🇵", format: "984 1234567" },
  { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾", format: "12-345 6789" },
  { code: "ID", name: "Indonesia", dialCode: "+62", flag: "🇮🇩", format: "812-3456-7890" },
  { code: "PH", name: "Philippines", dialCode: "+63", flag: "🇵🇭", format: "917 123 4567" },
  { code: "VN", name: "Vietnam", dialCode: "+84", flag: "🇻🇳", format: "91 234 5678" },
  { code: "TH", name: "Thailand", dialCode: "+66", flag: "🇹🇭", format: "81 234 5678" },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵", format: "90-1234-5678" },
  { code: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷", format: "10-1234-5678" },
  { code: "CN", name: "China", dialCode: "+86", flag: "🇨🇳", format: "138 0000 0000" },
  { code: "HK", name: "Hong Kong", dialCode: "+852", flag: "🇭🇰", format: "9123 4567" },
  { code: "TW", name: "Taiwan", dialCode: "+886", flag: "🇹🇼", format: "912 345 678" },
  { code: "NZ", name: "New Zealand", dialCode: "+64", flag: "🇳🇿", format: "21 123 4567" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪", format: "151 12345678" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷", format: "6 12 34 56 78" },
  { code: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹", format: "320 123 4567" },
  { code: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸", format: "612 34 56 78" },
  { code: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱", format: "6 12345678" },
  { code: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭", format: "78 123 45 67" },
  { code: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪", format: "70 123 45 67" },
  { code: "NO", name: "Norway", dialCode: "+47", flag: "🇳🇴", format: "412 34 567" },
  { code: "DK", name: "Denmark", dialCode: "+45", flag: "🇩🇰", format: "20 12 34 56" },
  { code: "PL", name: "Poland", dialCode: "+48", flag: "🇵🇱", format: "512 345 678" },
  { code: "BE", name: "Belgium", dialCode: "+32", flag: "🇧🇪", format: "470 12 34 56" },
  { code: "AT", name: "Austria", dialCode: "+43", flag: "🇦🇹", format: "664 1234567" },
  { code: "IE", name: "Ireland", dialCode: "+353", flag: "🇮🇪", format: "85 123 4567" },
  { code: "PT", name: "Portugal", dialCode: "+351", flag: "🇵🇹", format: "912 345 678" },
  { code: "GR", name: "Greece", dialCode: "+30", flag: "🇬🇷", format: "691 234 5678" },
  { code: "TR", name: "Turkey", dialCode: "+90", flag: "🇹🇷", format: "532 123 45 67" },
  { code: "RU", name: "Russia", dialCode: "+7", flag: "🇷🇺", format: "912 345-67-89" },
  { code: "UA", name: "Ukraine", dialCode: "+380", flag: "🇺🇦", format: "50 123 4567" },
  { code: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷", format: "(11) 98765-4321" },
  { code: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽", format: "55 1234 5678" },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷", format: "11 1234-5678" },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱", format: "9 1234 5678" },
  { code: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴", format: "300 1234567" },
  { code: "PE", name: "Peru", dialCode: "+51", flag: "🇵🇪", format: "912 345 678" },
  { code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦", format: "82 123 4567" },
  { code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬", format: "803 123 4567" },
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪", format: "712 345678" },
  { code: "EG", name: "Egypt", dialCode: "+20", flag: "🇪🇬", format: "10 1234 5678" },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭", format: "24 123 4567" },
  { code: "IL", name: "Israel", dialCode: "+972", flag: "🇮🇱", format: "50-123-4567" },
];

interface CountryPhoneInputProps {
  value: string;
  onChange: (fullPhoneNumber: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export const CountryPhoneInput: React.FC<CountryPhoneInputProps> = ({
  value,
  onChange,
  required = false,
  disabled = false,
  className = "",
  placeholder,
}) => {
  // Parse initial country or default to US (+1)
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(() => {
    if (value) {
      const matched = COUNTRIES.find((c) => value.startsWith(c.dialCode));
      if (matched) return matched;
    }
    return COUNTRIES[0]; // US default
  });

  // Extract raw digits excluding dialCode
  const [rawNumber, setRawNumber] = useState<string>(() => {
    if (value) {
      if (value.startsWith(selectedCountry.dialCode)) {
        return value.slice(selectedCountry.dialCode.length).trim();
      }
      return value.trim();
    }
    return "";
  });

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync external value updates if changed externally
  useEffect(() => {
    if (!value) {
      setRawNumber("");
      return;
    }
    const matched = COUNTRIES.find((c) => value.startsWith(c.dialCode));
    if (matched && matched.dialCode !== selectedCountry.dialCode) {
      setSelectedCountry(matched);
      setRawNumber(value.slice(matched.dialCode.length).trim());
    }
  }, [value]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleCountrySelect = (country: CountryInfo) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery("");
    const combined = rawNumber.trim() ? `${country.dialCode} ${rawNumber.trim()}` : "";
    onChange(combined);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only permit digits, spaces, hyphens, and parentheses
    const sanitized = e.target.value.replace(/[^\d\s\-\(\)]/g, "");
    setRawNumber(sanitized);
    const combined = sanitized.trim() ? `${selectedCountry.dialCode} ${sanitized.trim()}` : "";
    onChange(combined);
  };

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.dialCode.includes(searchQuery) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all overflow-hidden">
        {/* Country Code Trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-900/80 hover:bg-slate-800 text-white border-r border-slate-800 transition-colors shrink-0 font-mono text-xs select-none focus:outline-none"
          title={`${selectedCountry.name} (${selectedCountry.dialCode})`}
        >
          <span className="text-base leading-none">{selectedCountry.flag}</span>
          <span className="font-semibold text-blue-400">{selectedCountry.dialCode}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Phone Digits Input */}
        <div className="relative flex-1 flex items-center min-w-0">
          <input
            type="tel"
            value={rawNumber}
            onChange={handleNumberChange}
            disabled={disabled}
            required={required}
            placeholder={placeholder || selectedCountry.format || "Mobile number"}
            className="w-full bg-transparent px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
          />
        </div>
      </div>

      {/* Searchable Country Picker Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-72 max-w-[90vw] bg-slate-900 border border-blue-500/40 rounded-xl shadow-2xl shadow-black/80 z-50 overflow-hidden animate-in fade-in zoom-in-95">
          {/* Search Header */}
          <div className="p-2 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country or code..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* List of Countries */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/40 p-1">
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 font-mono">
                No matching countries found
              </div>
            ) : (
              filteredCountries.map((country) => {
                const isSelected = country.code === selectedCountry.code;
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-mono transition-colors text-left ${
                      isSelected
                        ? "bg-blue-600/20 text-blue-200 border border-blue-500/30"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{country.flag}</span>
                      <span className="truncate text-white">{country.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2 font-semibold text-blue-400">
                      <span>{country.dialCode}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-purple-300" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
