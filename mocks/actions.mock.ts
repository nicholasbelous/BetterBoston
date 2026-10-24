// ============================================================================
// MOCK DATA - NOT REAL. Placeholder recommended actions.
//
// These are general, plain-language ideas copied from the design. They are NOT
// verified Massachusetts programs: no links, phone numbers, dollar amounts or
// eligibility rules. Real, verified programs come from data/programs/ through
// POST /api/action-plan. Until then the UI marks these "Placeholder".
// ============================================================================
import type { IconName } from "@/components/ui/Icon";
import type { ProgramTopic, Tenure } from "@/lib/types";

export interface MockAction {
  id: string;
  title: string;
  summary: string;
  detail: string;
  steps: string[];
  icon: IconName;
  audience: Tenure[];
  topics: ProgramTopic[];
}

export const MOCK_ACTIONS: MockAction[] = [
  {
    id: "mock-shade-trees",
    title: "Plant shade trees",
    summary: "Can reduce surrounding temperatures and lower cooling costs.",
    detail:
      "Trees on the south and west sides of a building give the most afternoon shade. Leafy blocks also tend to feel cooler than paved ones.",
    steps: [
      "Pick a spot that gets strong afternoon sun.",
      "Choose a tree that suits the space and local climate.",
      "Renters: check whether your city lets residents request a street tree.",
    ],
    icon: "tree",
    audience: ["owner", "renter"],
    topics: ["trees", "heat"],
  },
  {
    id: "mock-exterior-shade",
    title: "Add exterior shade",
    summary: "Consider awnings, pergolas, or shade sails for sunny sides.",
    detail:
      "Blocking sun before it reaches the window keeps more heat out than curtains alone. Removable shade sails can work for renters.",
    steps: [
      "Find the windows and patios that get the most direct sun.",
      "Compare awnings, pergolas and shade sails for those spots.",
      "Renters: ask your landlord before attaching anything.",
    ],
    icon: "umbrella",
    audience: ["owner", "renter"],
    topics: ["heat"],
  },
  {
    id: "mock-insulation",
    title: "Improve home insulation",
    summary: "Keeps indoor temperatures comfortable during heat waves.",
    detail:
      "Insulation and air sealing slow heat moving in during summer and out during winter. Many homes start with the attic.",
    steps: [
      "Look at attic and top-floor ceiling insulation first.",
      "Ask about a home energy assessment.",
      "Check for current rebates before you buy anything.",
    ],
    icon: "insulation",
    audience: ["owner"],
    topics: ["energy", "heat"],
  },
  {
    id: "mock-cool-roof",
    title: "Cool roofing materials",
    summary: "Reflects more solar radiation and reduces heat absorption.",
    detail:
      "Lighter, reflective roof surfaces absorb less sun than dark ones, which can keep the top floor cooler.",
    steps: [
      "Check the age and condition of your current roof.",
      "Ask roofers about reflective options when it is time to replace.",
      "Check for current rebates before you commit.",
    ],
    icon: "roof",
    audience: ["owner"],
    topics: ["energy", "heat"],
  },
  {
    id: "mock-landscaping",
    title: "Use heat-resilient landscaping",
    summary: "Native plants provide shade and require less water.",
    detail:
      "Native plants handle local weather well and need less watering. Replacing bare pavement or lawn with plantings can cool a yard.",
    steps: [
      "Replace patches of bare pavement or turf with plantings.",
      "Choose native, drought-tolerant species.",
      "Group plants near walls that get the most sun.",
    ],
    icon: "leaf",
    audience: ["owner"],
    topics: ["trees", "heat"],
  },
  {
    id: "mock-cooling-center",
    title: "Know your nearest cooling center",
    summary: "Find a cool public space to use during dangerous heat.",
    detail:
      "Cities often open cooling centers during heat waves. Look up where yours are before the next hot spell.",
    steps: [
      "Search your city's website for cooling centers.",
      "Save the address and hours on your phone.",
      "Share it with neighbors who may not have air conditioning.",
    ],
    icon: "pin",
    audience: ["owner", "renter"],
    topics: ["heat"],
  },
  {
    id: "mock-landlord",
    title: "Ask your landlord about cooling upgrades",
    summary: "Shade, insulation and window fixes often need landlord approval.",
    detail:
      "Renters can still push for changes. A written request listing the specific problem is easier to act on.",
    steps: [
      "Note which rooms get hottest and when.",
      "Send your landlord a short written request.",
      "Keep a copy of the request and any reply.",
    ],
    icon: "home",
    audience: ["renter"],
    topics: ["energy", "heat"],
  },
];
