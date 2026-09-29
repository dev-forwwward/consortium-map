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
}
