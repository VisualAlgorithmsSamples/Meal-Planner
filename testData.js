export const TEST_DATA = {
  dishes: [
    { id: 1001, name: "Overnight Oats",   calories: 350, servings: 1, type: ["breakfast"],             alwaysAvailable: false },
    { id: 1002, name: "Greek Yogurt",      calories: 150, servings: 1, type: ["breakfast", "snack"],   alwaysAvailable: true  },
    { id: 1003, name: "Chicken Salad",     calories: 480, servings: 2, type: ["lunch"],                alwaysAvailable: false },
    { id: 1004, name: "Pasta Bolognese",   calories: 620, servings: 4, type: ["dinner"],               alwaysAvailable: false },
    { id: 1005, name: "Vegetable Soup",    calories: 280, servings: 3, type: ["lunch", "dinner"],      alwaysAvailable: false },
    { id: 1006, name: "Salmon & Rice",     calories: 550, servings: 2, type: ["dinner"],               alwaysAvailable: false },
    { id: 1007, name: "Banana",            calories: 90,  servings: 1, type: ["snack"],                alwaysAvailable: true  },
    { id: 1008, name: "Protein Shake",     calories: 200, servings: 1, type: ["breakfast", "snack"],   alwaysAvailable: false },
    { id: 1009, name: "Avocado Toast",     calories: 420, servings: 1, type: ["breakfast", "lunch"],   alwaysAvailable: false },
    { id: 1010, name: "Stir Fry Tofu",     calories: 390, servings: 2, type: ["lunch", "dinner"],      alwaysAvailable: false },
  ],

  // Cooked batches currently in the fridge.
  // Portions reflect state after plan assignments below (each fridge assignment decrements by 1).
  fridge: [
    { id: 2001, dishId: 1003, name: "Chicken Salad",   calories: 480, portions: 1 }, // 2 cooked, 1 → Friday lunch
    { id: 2002, dishId: 1004, name: "Pasta Bolognese", calories: 620, portions: 2 }, // 3 cooked, 1 → Saturday dinner
    { id: 2003, dishId: 1005, name: "Vegetable Soup",  calories: 280, portions: 3 }, // 4 cooked, 1 → Saturday lunch
  ],

  freezer: [
    { id: 3001, dishId: 1004, name: "Pasta Bolognese", calories: 620, portions: 3 },
    { id: 3002, dishId: 1010, name: "Stir Fry Tofu",   calories: 390, portions: 2 },
  ],

  settings: { dailyCalories: 2200 },

  plan: {
    Monday:    { breakfast: [], lunch: [], dinner: [], snack: [] },
    Tuesday:   { breakfast: [], lunch: [], dinner: [], snack: [] },
    Wednesday: { breakfast: [], lunch: [], dinner: [], snack: [] },
    Thursday:  { breakfast: [], lunch: [], dinner: [], snack: [] },
    Friday: {
      breakfast: [{ id: 1009, dishId: 1009, name: "Avocado Toast",  calories: 420, servings: 1, type: ["breakfast","lunch"],  alwaysAvailable: false, source: "dish",   qty: 1 }],
      lunch:     [{ id: 2001, dishId: 1003, name: "Chicken Salad",  calories: 480, portions: 2, type: "both",                                         source: "fridge", qty: 1 }],
      dinner:    [{ id: 1006, dishId: 1006, name: "Salmon & Rice",  calories: 550, servings: 2, type: ["dinner"],             alwaysAvailable: false, source: "dish",   qty: 1 }],
      snack:     [{ id: 1007, dishId: 1007, name: "Banana",         calories: 90,  servings: 1, type: ["snack"],              alwaysAvailable: true,  source: "dish",   qty: 1 }],
    },
    Saturday: {
      breakfast: [{ id: 1001, dishId: 1001, name: "Overnight Oats",   calories: 350, servings: 1, type: ["breakfast"],           alwaysAvailable: false, source: "dish",   qty: 1 }],
      lunch:     [{ id: 2003, dishId: 1005, name: "Vegetable Soup",   calories: 280, portions: 4, type: "both",                                          source: "fridge", qty: 1 }],
      dinner:    [{ id: 2002, dishId: 1004, name: "Pasta Bolognese",  calories: 620, portions: 3, type: "both",                                          source: "fridge", qty: 1 }],
      snack:     [],
    },
    Sunday: {
      breakfast: [{ id: 1002, dishId: 1002, name: "Greek Yogurt",    calories: 150, servings: 1, type: ["breakfast","snack"],  alwaysAvailable: true,  source: "dish",   qty: 1 }],
      lunch:     [],
      dinner:    [],
      snack:     [{ id: 1008, dishId: 1008, name: "Protein Shake",   calories: 200, servings: 1, type: ["breakfast","snack"],  alwaysAvailable: false, source: "dish",   qty: 1 }],
    },
  },

  history: [],
};
