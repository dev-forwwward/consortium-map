export interface Location {
  id: string;
  name: string;
  category: string;
  city: string;
  state: string;
  image: string;
  latitude: number;
  longitude: number;
  /** Project page URL — only set when the data comes from the Webflow CMS. */
  url?: string;
  /**
   * The CMS card this pin belongs to, when one card has several pins (one per
   * building). Unset when the pin is the card itself; use `cardIdOf`.
   */
  cardId?: string;
}

/** The id of the list card a location belongs to. */
export function cardIdOf(location: Pick<Location, 'id' | 'cardId'>): string {
  return location.cardId ?? location.id;
}
