export const LANGUAGES = [
  "English",
  "Tamil",
  "Hindi",
  "Telugu",
  "Malayalam",
  "Kannada",
  "Bengali",
];
export const LEVELS = [
  "Getting started",
  "Building confidence",
  "Comfortable speaking",
];
export const GOALS = [
  "Everyday conversations",
  "Career & interviews",
  "Workplace communication",
  "Travel & connection",
];
export const SCENARIOS = [
  {
    id: "daily",
    title: "A little about your day",
    category: "Everyday",
    level: "All levels",
    minutes: 5,
    icon: "sun",
    color: "peach",
    description: "Turn everyday moments into a natural conversation.",
    opening: "Hi, I’m Liya. What has been the best part of your day so far?",
    instruction:
      "Discuss the learner’s day. Ask specific, friendly follow-up questions.",
  },
  {
    id: "introductions",
    title: "Make a great introduction",
    category: "Everyday",
    level: "Getting started",
    minutes: 5,
    icon: "wave",
    color: "lavender",
    description: "Meet someone new and tell your story.",
    opening:
      "Hi, I’m Liya. Imagine we’ve just met. What would you like me to know about you?",
    instruction:
      "Role-play meeting someone for the first time. Help with introductions.",
  },
  {
    id: "interview",
    title: "Your next interview",
    category: "Career",
    level: "Building confidence",
    minutes: 10,
    icon: "case",
    color: "blue",
    description: "Explain your experience with clarity and confidence.",
    opening:
      "Welcome to your practice interview. Which role are you applying for?",
    instruction:
      "Be a supportive interviewer. Ask one interview question at a time and tailor it to the stated role. Do not invent the learner’s experience.",
  },
  {
    id: "meeting",
    title: "Speak up in a meeting",
    category: "Workplace",
    level: "Building confidence",
    minutes: 10,
    icon: "people",
    color: "mint",
    description: "Share an update, ask a question, make your point.",
    opening:
      "Let’s practise a team meeting. What project would you like to give an update on?",
    instruction:
      "Role-play a colleague in a team meeting. Practise concise updates and clarifying questions.",
  },
  {
    id: "travel",
    title: "Your next adventure",
    category: "Travel",
    level: "All levels",
    minutes: 5,
    icon: "globe",
    color: "peach",
    description: "Find your way, order a meal and meet new people.",
    opening:
      "Imagine you’ve arrived in a new city. Where are you travelling, and what would you like to do first?",
    instruction:
      "Role-play a travel situation chosen by the learner. Use practical vocabulary.",
  },
  {
    id: "incident",
    title: "Explain a technical incident",
    category: "Workplace",
    level: "Comfortable speaking",
    minutes: 10,
    icon: "bolt",
    color: "lavender",
    description: "Communicate impact, recovery and next steps.",
    opening:
      "Let’s practise an incident update. Using a fictional example, what happened and who was affected?",
    instruction:
      "Role-play a stakeholder receiving a fictional technical incident update. Help organise impact, actions and next steps. Do not ask for confidential customer data.",
  },
];
export function scenarioById(id) {
  return SCENARIOS.find((s) => s.id === id);
}
export function recommendedScenario(goal) {
  return (
    {
      "Career & interviews": "interview",
      "Workplace communication": "meeting",
      "Travel & connection": "travel",
    }[goal] || "daily"
  );
}
export const PROFILE_DEFAULTS = {
  native_language: "English",
  level: LEVELS[1],
  goal: GOALS[0],
  daily_minutes: 10,
};
