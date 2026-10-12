import { useEffect, useRef, useState } from 'react';
import { searchPlaces } from '../services/geocoding.js';

export default function LocationField({
  label,
  name,
  placeholder,
  value,
  setValue,
  setPlace,
  recentLocations,
  onSelectRecent,
  onClearRecent,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timer = useRef();
  const request = useRef();
  const listId = `${name}-suggestions`;

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      request.current?.abort();
    },
    [],
  );

  const search = (text) => {
    clearTimeout(timer.current);
    request.current?.abort();
    setValue(text);
    setPlace(null);
    setActiveIndex(-1);

    if (text.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      setSearching(true);
      try {
        const places = await searchPlaces(text, controller.signal);
        if (!controller.signal.aborted) setSuggestions(places);
      } catch (error) {
        if (error.name !== 'AbortError') setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
  };

  const handleSelect = (place) => {
    setValue(place.display_name);
    setPlace(place);
    setSuggestions([]);
    setFocused(false);
    setActiveIndex(-1);
  };

  const handleSelectRecent = (place) => {
    onSelectRecent(place);
    setFocused(false);
    setActiveIndex(-1);
  };

  const recentItems =
    suggestions.length === 0 && !value.trim() ? recentLocations : [];
  const selectableItems =
    suggestions.length > 0 ? suggestions : recentItems;
  const showSuggestions =
    focused && (searching || selectableItems.length > 0);

  const activeItemId =
    activeIndex >= 0 ? `${name}-option-${activeIndex}` : undefined;

  const handleKeyDown = (event) => {
    if (!showSuggestions) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(
        (current) => (current + 1) % selectableItems.length,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(
        (current) =>
          (current - 1 + selectableItems.length) % selectableItems.length,
      );
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      if (suggestions.length > 0) handleSelect(suggestions[activeIndex]);
      else onSelectRecent(recentItems[activeIndex]);
    } else if (event.key === 'Escape') {
      setSuggestions([]);
      setFocused(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="field location-field">
      <label htmlFor={name}>{label}</label>
      <div className="input-wrap">
        <span
          className={`field-icon ${name === 'origin' ? 'origin-icon' : 'destination-icon'}`}
        ></span>
        <input
          id={name}
          autoComplete="off"
          value={value}
          onChange={(event) => search(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={handleKeyDown}
          aria-expanded={showSuggestions}
          aria-controls={listId}
          aria-activedescendant={activeItemId}
          aria-autocomplete="list"
          role="combobox"
          placeholder={placeholder}
          required
        />
        <button
          type="button"
          className="clear-btn"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            setValue('');
            setPlace(null);
            setSuggestions([]);
          }}
        >
          ×
        </button>
      </div>

      {showSuggestions && (
        <div
          className="suggestions visible"
          id={listId}
          role="listbox"
        >
          {searching ? (
            <div className="suggestion">Searching...</div>
          ) : (
            <>
              {suggestions.length > 0 &&
                suggestions.map((item, index) => (
                  <button
                    type="button"
                    role="option"
                    id={`${name}-option-${index}`}
                    aria-selected={activeIndex === index}
                    className={`suggestion ${activeIndex === index ? 'active' : ''}`}
                    key={`${item.lat}-${item.lon}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(item)}
                  >
                    {item.display_name}
                  </button>
                ))}

              {suggestions.length === 0 && recentItems.length > 0 && (
                <>
                  <div className="suggestion suggestion-label">
                    <span>Recent locations</span>
                    <button
                      type="button"
                      className="clear-recent-btn"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={onClearRecent}
                    >
                      Clear
                    </button>
                  </div>
                  {recentItems.map((item, index) => (
                    <button
                      type="button"
                      role="option"
                      id={`${name}-option-${index}`}
                      aria-selected={activeIndex === index}
                      className={`suggestion recent-item ${activeIndex === index ? 'active' : ''}`}
                      onMouseDown={(event) => event.preventDefault()}
                      key={`${item.display_name}-${item.lat}-${item.lon}`}
                      onClick={() => handleSelectRecent(item)}
                    >
                      {item.display_name}
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

