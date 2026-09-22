import type { ClosetKind } from "./types";

/** How a Virtual Closet sheet maps onto the Daily Overview outfit columns. */
export interface ClosetConfig {
  sheet: string;
  idCol: string;
  /** daily column -> closet column */
  map: Record<string, string>;
  /** closet columns used to build the picker's display label, in order */
  labelCols: string[];
}

export const CLOSET: Record<ClosetKind, ClosetConfig> = {
  shirt: {
    sheet: "Shirt", idCol: "Shirt ID",
    map: {
      "Shirt Type": "Shirt Type", "Shirt Color Primary": "Shirt Color Primary",
      "Shirt Color Secondary": "Shirt Color Secondary", "Shirt Company": "Shirt Brand",
      "Shirt Design": "Shirt Design", "Shirt Color Short": "Shirt Color Short",
    },
    labelCols: ["Shirt Color Primary", "Shirt Type", "Shirt Brand", "Shirt Design"],
  },
  pants: {
    sheet: "Pants", idCol: "Pants ID",
    map: {
      "Pants Type": "Pants Type", "Pants Color Primary": "Pants Color Primary",
      "Pants Color Secondary": "Pants Color Secondary", "Pants Brand": "Pants Brand",
      "Pants Design": "Pants Design", "Pants Color Short": "Pants Color Short",
    },
    labelCols: ["Pants Color Primary", "Pants Type", "Pants Brand", "Pants Design"],
  },
  shoes: {
    sheet: "Shoes", idCol: "Shoe ID",
    map: {
      "Shoe Type": "Shoe Type", "Shoe Color Primary": "Shoe Color Primary",
      "Shoe Color Secondary": "Shoe Color Secondary", "Shoe Brand": "Shoe Brand",
      "Shoe Design": "Shoe Design", "Shoe Color Short": "Shoe Color Short",
    },
    labelCols: ["Shoe Color Primary", "Shoe Type", "Shoe Brand", "Shoe Design"],
  },
  socks: {
    sheet: "Socks", idCol: "Sock ID",
    map: {
      "Sock Color Primary": "Sock Color Primary", "Sock Color Secondary": "Sock Color Secondary",
      "Sock Company": "Sock Brand", "Sock Design": "Sock Design", "Sock Color Short": "Sock Color Short",
    },
    labelCols: ["Sock Color Primary", "Sock Brand", "Sock Design"],
  },
  hat: {
    sheet: "Hat", idCol: "Hat ID",
    map: {
      "Hat Type": "Hat Type", "Hat Color Primary": "Hat Color Primary",
      "Hat Color Secondary": "Hat Color Secondary", "Hat Company": "Hat Brand",
      "Hat Design": "Hat Design", "Hat Color Short": "Hat Color Short",
    },
    labelCols: ["Hat Color Primary", "Hat Type", "Hat Brand", "Hat Design"],
  },
  jacket: {
    sheet: "Jacket", idCol: "Jacket ID",
    map: {
      "Jacket Type": "Jacket Type", "Jacket Color Primary": "Jacket Color Primary",
      "Jacket Color Secondary": "Jacket Color Secondary", "Jacket Company": "Jacket Brand",
      "Jacket Design": "Jacket Design", "Jacket Color Short": "Jacket Color Short",
    },
    labelCols: ["Jacket Color Primary", "Jacket Type", "Jacket Brand", "Jacket Design"],
  },
};

export interface ClosetItem {
  id: string;
  label: string;
  /** values keyed by DAILY column name, ready to spread into the form */
  values: Record<string, string>;
}

export type ClosetItems = Record<ClosetKind, ClosetItem[]>;
