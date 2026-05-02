import { useState, useEffect } from "react";

const SERVER = "";

function useFileStorage(key, initial) {
  const [value, setValue] = useState(() =>
    typeof initial === "function" ? initial() : initial
  );

  // Load persisted value from server on mount
  useEffect(() => {
    fetch(`${SERVER}/data`)
      .then(r => r.json())
      .then(data => { if (key in data && data[key] !== null) setValue(data[key]); })
      .catch(() => {});
  }, []);

  const set = (newValueOrFn) => {
    setValue(prev => {
      const next = typeof newValueOrFn === "function" ? newValueOrFn(prev) : newValueOrFn;
      fetch(`${SERVER}/data/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
      return next;
    });
  };

  return [value, set];
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TODAY = DAYS[(new Date().getDay() + 6) % 7];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_ICONS = { breakfast: "🌅", lunch: "🌿", dinner: "🌙", snack: "🍎" };

// Normalize legacy string type to array
const normType = (type) => Array.isArray(type) ? type : type === "both" ? ["lunch", "dinner"] : type ? [type] : [];


const initialPlan = () => {
  const plan = {};
  DAYS.forEach(day => {
    plan[day] = { breakfast: [], lunch: [], dinner: [], snack: [] };
  });
  return plan;
};

// Normalizes a stored slot to always be an array (handles old null/object format)
const toArr = (val) => Array.isArray(val) ? val : val ? [val] : [];

function reconcilePlanWithFridge(plan, fridge) {
  const stock = new Map(fridge.map(f => [f.id, f.portions]));
  const cleaned = {};
  for (const day of DAYS) {
    const dayPlan = plan[day] ?? {};
    cleaned[day] = {};
    for (const meal of MEAL_TYPES) {
      cleaned[day][meal] = toArr(dayPlan[meal]).filter(
        item => item.source !== "fridge" || (stock.get(item.id) ?? 0) > 0
      );
    }
  }
  return cleaned;
}

export default function MealPlanner() {
  // Dynamic: resets/changes week to week
  const [plan, setPlan] = useFileStorage("mp_plan", initialPlan);
  const [freezer, setFreezer] = useFileStorage("mp_freezer", []);
  const [fridge, setFridge] = useFileStorage("mp_fridge", []);
  // Static: personal dish library, rarely changes
  const [dishes, setDishes] = useFileStorage("mp_dishes", []);
  const [settings, setSettings] = useFileStorage("mp_settings", { dailyCalories: 2200 });
  const [history, setHistory] = useFileStorage("mp_history", []);
  const [activeTab, setActiveTab] = useState("plan");
  const [activeDay, setActiveDay] = useState(TODAY);
  const [showAddDish, setShowAddDish] = useState(false);
  const [selectingFor, setSelectingFor] = useState(null); // { day, meal, isBackup }
  const [newDish, setNewDish] = useState({ name: "", calories: "", servings: 1, type: [], alwaysAvailable: false });
  const [cookInputs, setCookInputs] = useState({});
  const [cookedFeedback, setCookedFeedback] = useState({});
  const [editingDish, setEditingDish] = useState(null);

  const allOptions = [
    ...fridge.map(f => ({ ...f, source: "fridge", type: "both" })),
    ...dishes.map(d => ({ ...d, source: "dish" })),
    ...freezer.map(f => ({ ...f, source: "freezer", type: "both" })),
  ];

  const getLastOccurrenceDate = (dayName) => {
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    // Parse as noon UTC to avoid DST edge cases on date-only strings
    const todayDate = new Date(todayStr + "T12:00:00Z");
    const todayDow = (todayDate.getUTCDay() + 6) % 7; // 0=Mon … 6=Sun
    const targetDow = DAYS.indexOf(dayName);
    let daysAgo = (todayDow - targetDow + 7) % 7;
    if (daysAgo === 0) daysAgo = 7;
    const result = new Date(todayStr + "T12:00:00Z");
    result.setUTCDate(result.getUTCDate() - daysAgo);
    return result.toISOString().slice(0, 10);
  };

  const handleExport = () => {
    const data = { dishes, fridge, freezer, settings, plan, history };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meal-planner-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.dishes) setDishes(data.dishes);
        if (data.fridge) setFridge(data.fridge);
        if (data.freezer) setFreezer(data.freezer);
        if (data.settings) setSettings(data.settings);
        if (data.plan) {
          const restoredFridge = data.fridge ?? fridge;
          setPlan(reconcilePlanWithFridge(data.plan, restoredFridge));
        }
        if (data.history) setHistory(data.history);
      } catch { /* invalid file, ignore */ }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const returnFridgePortion = (item, count = 1) => {
    setFridge(prev => {
      const existing = prev.find(f => f.id === item.id);
      if (existing) {
        return prev.map(f => f.id === item.id ? { ...f, portions: f.portions + count } : f);
      }
      return [...prev, { id: item.id, dishId: item.dishId ?? null, name: item.name, calories: item.calories, portions: count }];
    });
  };

  const assignMeal = (day, meal, item) => {
    if (item.source === "fridge") {
      setFridge(prev => prev
        .map(f => f.id === item.id ? { ...f, portions: f.portions - 1 } : f)
        .filter(f => f.portions > 0)
      );
    }
    setPlan(prev => ({
      ...prev,
      [day]: { ...prev[day], [meal]: [...toArr(prev[day][meal]), { ...item, qty: 1 }] }
    }));
    setSelectingFor(null);
  };

  const clearMeal = (day, meal, index) => {
    const items = toArr(plan[day][meal]);
    const removed = items[index];
    if (removed?.source === "fridge") returnFridgePortion(removed, removed.qty ?? 1);
    setPlan(prev => ({
      ...prev,
      [day]: { ...prev[day], [meal]: items.filter((_, i) => i !== index) }
    }));
  };

  const changeMealQty = (day, meal, index, delta) => {
    const items = toArr(plan[day][meal]);
    const item = items[index];
    const newQty = (item.qty ?? 1) + delta;
    if (newQty < 1) { clearMeal(day, meal, index); return; }
    if (item.source === "fridge") {
      if (delta > 0) {
        const available = fridge.find(f => f.id === item.id)?.portions ?? 0;
        if (available < 1) return;
        setFridge(prev => prev
          .map(f => f.id === item.id ? { ...f, portions: f.portions - 1 } : f)
          .filter(f => f.portions > 0)
        );
      } else {
        returnFridgePortion(item);
      }
    }
    setPlan(prev => ({
      ...prev,
      [day]: { ...prev[day], [meal]: items.map((it, i) => i === index ? { ...it, qty: newQty } : it) }
    }));
  };

  const getDayCalories = (day) => {
    const d = plan[day];
    const sumArr = (arr) => toArr(arr).reduce((acc, item) => acc + (item?.calories ?? 0) * (item?.qty ?? 1), 0);
    return MEAL_TYPES.reduce((acc, meal) => acc + sumArr(d[meal]), 0);
  };

  const completeDayMeals = (day) => {
    const date = getLastOccurrenceDate(day);
    const meals = {};
    MEAL_TYPES.forEach(meal => {
      const items = toArr(plan[day][meal]);
      if (items.length > 0) meals[meal] = items.map(item => ({
        name: item.name,
        calories: item.calories,
        qty: item.qty ?? 1,
        totalKcal: item.calories * (item.qty ?? 1),
      }));
    });
    const totalKcal = getDayCalories(day);
    setHistory(prev => [...prev, { date, day, totalKcal, meals }]);
    setPlan(prev => ({ ...prev, [day]: { ...prev[day], breakfast: [], lunch: [], dinner: [], snack: [] } }));
  };

  const addDish = () => {
    if (!newDish.name || !newDish.calories || !newDish.type.length) return;
    setDishes(prev => [...prev, { ...newDish, id: Date.now(), calories: parseInt(newDish.calories), servings: parseInt(newDish.servings) }]);
    setNewDish({ name: "", calories: "", servings: 1, type: [], alwaysAvailable: false });
    setShowAddDish(false);
  };

  const upsertStorage = (setter, dishId, name, calories, count) => {
    if (count <= 0) return;
    setter(prev => {
      const existing = prev.find(f => f.dishId === dishId);
      if (existing) {
        return prev.map(f => f.dishId === dishId ? { ...f, portions: f.portions + count } : f);
      }
      return [...prev, { id: Date.now(), dishId, name, calories, portions: count }];
    });
  };

  const handleCookDish = (dish) => {
    const freezerCount = Math.min(parseInt(cookInputs[dish.id] ?? 0) || 0, dish.servings);
    const fridgeCount = dish.servings - freezerCount;
    upsertStorage(setFreezer, dish.id, dish.name, dish.calories, freezerCount);
    upsertStorage(setFridge, dish.id, dish.name, dish.calories, fridgeCount);
    setCookInputs(prev => ({ ...prev, [dish.id]: 0 }));
    setCookedFeedback(prev => ({ ...prev, [dish.id]: true }));
    setTimeout(() => setCookedFeedback(prev => ({ ...prev, [dish.id]: false })), 1500);
  };

  const removeFreezerItem = (id) => setFreezer(prev => prev.filter(f => f.id !== id));
  const changeFreezerPortions = (id, delta) => {
    setFreezer(prev => prev
      .map(f => f.id === id ? { ...f, portions: f.portions + delta } : f)
      .filter(f => f.portions > 0)
    );
  };

  const moveToFridge = (item) => {
    setFreezer(prev => prev
      .map(f => f.id === item.id ? { ...f, portions: f.portions - 1 } : f)
      .filter(f => f.portions > 0)
    );
    setFridge(prev => {
      const match = prev.find(f => item.dishId ? f.dishId === item.dishId : f.name === item.name);
      if (match) {
        return prev.map(f => f.id === match.id ? { ...f, portions: f.portions + 1 } : f);
      }
      return [...prev, { id: Date.now(), dishId: item.dishId ?? null, name: item.name, calories: item.calories, portions: 1 }];
    });
  };

  const removeFridgeItem = (id) => setFridge(prev => prev.filter(f => f.id !== id));
  const changeFridgePortions = (id, delta) => {
    setFridge(prev => prev
      .map(f => f.id === id ? { ...f, portions: f.portions + delta } : f)
      .filter(f => f.portions > 0)
    );
  };

  const removeDish = (id) => setDishes(prev => prev.filter(d => d.id !== id));

  const saveEditDish = (form) => {
    const calories = parseInt(form.calories);
    const servings = parseInt(form.servings);
    const { type, alwaysAvailable } = form;
    const id = editingDish.id;
    setDishes(prev => prev.map(d => d.id === id ? { ...d, calories, servings, type, alwaysAvailable } : d));
    const updateCalories = items => items.map(f => f.dishId === id ? { ...f, calories } : f);
    setFreezer(updateCalories);
    setFridge(updateCalories);
    setPlan(prev => {
      const updated = { ...prev };
      DAYS.forEach(day => {
        const d = prev[day];
        const patch = {};
        MEAL_TYPES.forEach(key => {
          const arr = toArr(d[key]);
          const next = arr.map(item => item?.id === id ? { ...item, calories, servings, type } : item);
          if (next.some((item, i) => item !== arr[i])) patch[key] = next;
        });
        if (Object.keys(patch).length) updated[day] = { ...d, ...patch };
      });
      return updated;
    });
    setEditingDish(null);
  };

  const filteredOptions = (meal) => allOptions.filter(o => {
    if (o.source === "fridge") {
      if (!o.dishId) return true; // legacy item with no dish link
      const dish = dishes.find(d => d.id === o.dishId);
      return !dish || normType(dish.type).includes(meal);
    }
    if (o.source === "dish" && o.alwaysAvailable) return normType(o.type).includes(meal);
    return false;
  });

  const calorieColor = (cal) => {
    if (cal === 0) return "#666";
    const goal = settings.dailyCalories;
    if (cal < goal) return "#4ade80";
    if (cal < goal + 200) return "#facc15";
    return "#f87171";
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f0f13",
      color: "#e8e4dc",
      fontFamily: "'Georgia', serif",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a1a24 0%, #12121a 100%)",
        borderBottom: "1px solid #2a2a3a",
        padding: "20px 24px 0",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{
            fontSize: 26,
            fontWeight: "normal",
            letterSpacing: "0.05em",
            color: "#c8b97a",
            margin: "0 0 4px",
          }}>🥘 Meal Planner</h1>
          <p style={{ color: "#666", fontSize: 13, margin: "0 0 20px", fontFamily: "monospace" }}>
            Plan ahead · Eat well · Stay flexible
          </p>
          <div style={{ display: "flex", gap: 0, borderBottom: "none" }}>
            {["plan", "dishes", "fridge", "freezer", "settings"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                background: activeTab === tab ? "#c8b97a" : "transparent",
                color: activeTab === tab ? "#0f0f13" : "#888",
                border: "none",
                padding: "8px 20px",
                borderRadius: "6px 6px 0 0",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "monospace",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontWeight: activeTab === tab ? "bold" : "normal",
              }}>
                {tab === "plan" ? "📅 Week" : tab === "dishes" ? "🍽 Dishes" : tab === "fridge" ? "🧊 Fridge" : tab === "freezer" ? "❄️ Freezer" : "⚙ Settings"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>

        {/* PLAN TAB */}
        {activeTab === "plan" && (
          <div>
            {/* Day selector */}
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
              {DAYS.map((day, i) => {
                const cal = getDayCalories(day);
                const hasData = MEAL_TYPES.some(m => toArr(plan[day][m]).length > 0);
                return (
                  <button key={day} onClick={() => setActiveDay(day)} style={{
                    background: activeDay === day ? "#c8b97a" : hasData ? "#1e1e2e" : "#161620",
                    color: activeDay === day ? "#0f0f13" : hasData ? "#e8e4dc" : "#555",
                    border: day === TODAY && activeDay !== day ? "1px solid #c8b97a55" : activeDay === day ? "none" : "1px solid #2a2a3a",
                    borderRadius: 8,
                    padding: "8px 12px",
                    cursor: "pointer",
                    flex: 1,
                    minWidth: 70,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: "bold" }}>{SHORT_DAYS[i]}</div>
                    {day === TODAY && activeDay !== day && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#c8b97a", margin: "3px auto 0" }} />}
                    {hasData && <div style={{ fontSize: 10, color: activeDay === day ? "#0f0f13" : calorieColor(cal), marginTop: day === TODAY && activeDay !== day ? 0 : 2 }}>{cal} kcal</div>}
                  </button>
                );
              })}
            </div>

            {/* Day detail */}
            {MEAL_TYPES.map(meal => {
              const items = toArr(plan[activeDay][meal]);
              const mealTotal = items.reduce((acc, i) => acc + (i?.calories ?? 0) * (i?.qty ?? 1), 0);
              return (
                <div key={meal} style={{
                  background: "#161620",
                  border: "1px solid #2a2a3a",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 14,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#c8b97a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      {MEAL_ICONS[meal]} {meal}
                    </span>
                    {items.length > 0 && <span style={{ fontSize: 12, color: calorieColor(mealTotal), fontFamily: "monospace" }}>{mealTotal} kcal</span>}
                  </div>

                  {items.map((item, i) => {
                    const qty = item.qty ?? 1;
                    const itemCal = item.calories * qty;
                    const canIncrease = item.source === "dish" || (fridge.find(f => f.id === item.id)?.portions ?? 0) > 0;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1e1e2e", borderRadius: 8, padding: "10px 14px", marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace", marginTop: 2 }}>
                            {item.source === "dish" ? "✓ always available" : "🧊 fridge"} · {itemCal} kcal
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#161620", borderRadius: 6, padding: "4px 8px" }}>
                            <button onClick={() => changeMealQty(activeDay, meal, i, -1)} style={{
                              background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, width: 18, textAlign: "center",
                            }}>−</button>
                            <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: "bold", color: "#e8e4dc", minWidth: 16, textAlign: "center" }}>{qty}</span>
                            <button onClick={() => changeMealQty(activeDay, meal, i, 1)} style={{
                              background: "none", border: "none", color: canIncrease ? "#4ade80" : "#333", cursor: canIncrease ? "pointer" : "default", fontSize: 16, lineHeight: 1, padding: 0, width: 18, textAlign: "center",
                            }}>+</button>
                          </div>
                          <button onClick={() => clearMeal(activeDay, meal, i)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 18 }}>×</button>
                        </div>
                      </div>
                    );
                  })}

                  <button onClick={() => setSelectingFor({ day: activeDay, meal })} style={{
                    width: "100%", background: "#1a1a24", border: "1px dashed #3a3a4a", borderRadius: 8,
                    padding: "10px", color: "#666", cursor: "pointer", fontSize: 13, marginTop: items.length > 0 ? 4 : 0,
                  }}>+ Add {meal}</button>
                </div>
              );
            })}

            {/* Day total + complete */}
            {MEAL_TYPES.some(m => toArr(plan[activeDay][m]).length > 0) && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "#161620", border: "1px solid #2a2a3a", borderRadius: 8 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 16, color: calorieColor(getDayCalories(activeDay)), fontWeight: "bold" }}>
                    {getDayCalories(activeDay)}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: "#555" }}> / {settings.dailyCalories} kcal</span>
                </div>
                <button onClick={() => completeDayMeals(activeDay)} style={{
                  background: "#1e1e2e", border: "1px solid #3a3a4a", borderRadius: 8,
                  padding: "10px 16px", color: "#4ade80", cursor: "pointer",
                  fontFamily: "monospace", fontSize: 12, letterSpacing: "0.05em", whiteSpace: "nowrap",
                }}>day done</button>
              </div>
            )}
          </div>
        )}

        {/* DISHES TAB */}
        {activeTab === "dishes" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#888" }}>{dishes.length} dishes saved</span>
              <button onClick={() => setShowAddDish(true)} style={{
                background: "#c8b97a", color: "#0f0f13", border: "none", borderRadius: 8,
                padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: "bold",
              }}>+ New Dish</button>
            </div>

            {/* Cookable dishes */}
            {dishes.filter(d => !d.alwaysAvailable).map(dish => (
              <div key={dish.id} style={{
                background: "#161620", border: "1px solid #2a2a3a", borderRadius: 10,
                padding: "14px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setEditingDish({ ...dish })} style={{
                    background: "none", border: "none", padding: 0,
                    color: "#555", cursor: "pointer", fontFamily: "monospace", fontSize: 11,
                    textDecoration: "underline", textUnderlineOffset: 3, flexShrink: 0,
                  }}>edit</button>
                  <div>
                    <div style={{ fontSize: 15, marginBottom: 4 }}>{dish.name}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "#666" }}>
                      {dish.calories} kcal · {dish.servings} serving{dish.servings > 1 ? "s" : ""} · {normType(dish.type).join(", ") || "—"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#1a1a24", border: "1px solid #2a2a3a", borderRadius: 6, padding: "4px 8px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#555" }}>❄️</span>
                    <input
                      type="number" min={0} max={dish.servings}
                      value={cookInputs[dish.id] ?? 0}
                      onChange={e => setCookInputs(prev => ({ ...prev, [dish.id]: e.target.value }))}
                      style={{
                        width: 28, background: "none", border: "none", color: "#7ab8c8",
                        fontFamily: "monospace", fontSize: 12, textAlign: "center", outline: "none", padding: 0,
                      }}
                    />
                  </div>
                  <button onClick={() => handleCookDish(dish)} style={{
                    background: cookedFeedback[dish.id] ? "#4ade80" : "#1e1e2e",
                    border: `1px solid ${cookedFeedback[dish.id] ? "#4ade80" : "#3a3a4a"}`,
                    borderRadius: 6, padding: "4px 10px",
                    color: cookedFeedback[dish.id] ? "#0f0f13" : "#c8b97a",
                    cursor: "pointer", fontSize: 11,
                    fontFamily: "monospace", letterSpacing: "0.05em",
                    transition: "background 0.2s, color 0.2s, border-color 0.2s",
                  }}>{cookedFeedback[dish.id] ? "done!" : "cooked"}</button>
                  <button onClick={() => removeDish(dish.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 18 }}>×</button>
                </div>
              </div>
            ))}

            {/* Always available dishes */}
            {dishes.some(d => d.alwaysAvailable) && (
              <div style={{ marginTop: 8, marginBottom: 10 }}>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Always available</div>
                {dishes.filter(d => d.alwaysAvailable).map(dish => (
                  <div key={dish.id} style={{
                    background: "#161620", border: "1px solid #2a2a3a", borderRadius: 10,
                    padding: "14px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button onClick={() => setEditingDish({ ...dish })} style={{
                        background: "none", border: "none", padding: 0,
                        color: "#555", cursor: "pointer", fontFamily: "monospace", fontSize: 11,
                        textDecoration: "underline", textUnderlineOffset: 3, flexShrink: 0,
                      }}>edit</button>
                      <div>
                        <div style={{ fontSize: 15, marginBottom: 4 }}>{dish.name}</div>
                        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#666" }}>
                          {dish.calories} kcal · {normType(dish.type).join(", ") || "—"}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeDish(dish.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 18 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {showAddDish && (
              <div style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex",
                alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
              }}>
                <div style={{ background: "#1a1a24", border: "1px solid #3a3a4a", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380 }}>
                  <h3 style={{ margin: "0 0 20px", color: "#c8b97a", fontWeight: "normal" }}>Add New Dish</h3>
                  {[
                    { label: "Dish name", key: "name", type: "text" },
                    { label: "Calories per serving", key: "calories", type: "number" },
                    { label: "Servings per batch", key: "servings", type: "number" },
                  ].map(f => {
                    const disabled = f.key === "servings" && newDish.alwaysAvailable;
                    return (
                      <div key={f.key} style={{ marginBottom: 14, opacity: disabled ? 0.35 : 1 }}>
                        <label style={{ display: "block", fontSize: 11, fontFamily: "monospace", color: "#888", marginBottom: 6, textTransform: "uppercase" }}>{f.label}</label>
                        <input type={f.type} value={newDish[f.key]} onChange={e => setNewDish(p => ({ ...p, [f.key]: e.target.value }))}
                          disabled={disabled}
                          style={{ width: "100%", background: "#0f0f13", border: "1px solid #3a3a4a", borderRadius: 8, padding: "10px 12px", color: "#e8e4dc", fontSize: 14, boxSizing: "border-box" }} />
                      </div>
                    );
                  })}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 11, fontFamily: "monospace", color: "#888", marginBottom: 8, textTransform: "uppercase" }}>Suitable for</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {MEAL_TYPES.map(t => {
                        const selected = normType(newDish.type).includes(t);
                        return (
                          <button key={t} onClick={() => {
                            const cur = normType(newDish.type);
                            setNewDish(p => ({ ...p, type: selected ? cur.filter(x => x !== t) : [...cur, t] }));
                          }} style={{
                            background: selected ? "#c8b97a" : "#0f0f13", color: selected ? "#0f0f13" : "#888",
                            border: "1px solid #3a3a4a", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12,
                          }}>{MEAL_ICONS[t]} {t}</button>
                        );
                      })}
                    </div>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
                    <input type="checkbox" checked={newDish.alwaysAvailable}
                      onChange={e => setNewDish(p => ({ ...p, alwaysAvailable: e.target.checked }))}
                      style={{ width: 16, height: 16, accentColor: "#c8b97a", cursor: "pointer" }} />
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "#aaa" }}>Always available — no cooking needed</span>
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setShowAddDish(false)} style={{ flex: 1, background: "none", border: "1px solid #3a3a4a", borderRadius: 8, padding: 10, color: "#888", cursor: "pointer" }}>Cancel</button>
                    <button onClick={addDish} style={{ flex: 1, background: "#c8b97a", border: "none", borderRadius: 8, padding: 10, color: "#0f0f13", cursor: "pointer", fontWeight: "bold" }}>Add Dish</button>
                  </div>
                </div>
              </div>
            )}

            {editingDish && (
              <div style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex",
                alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
              }}>
                <div style={{ background: "#1a1a24", border: "1px solid #3a3a4a", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380 }}>
                  <h3 style={{ margin: "0 0 4px", color: "#c8b97a", fontWeight: "normal" }}>Edit Dish</h3>
                  <p style={{ margin: "0 0 20px", fontFamily: "monospace", fontSize: 13, color: "#666" }}>{editingDish.name}</p>
                  {[
                    { label: "Calories per serving", key: "calories", type: "number" },
                    { label: "Servings per batch", key: "servings", type: "number" },
                  ].map(f => {
                    const disabled = f.key === "servings" && editingDish.alwaysAvailable;
                    return (
                      <div key={f.key} style={{ marginBottom: 14, opacity: disabled ? 0.35 : 1 }}>
                        <label style={{ display: "block", fontSize: 11, fontFamily: "monospace", color: "#888", marginBottom: 6, textTransform: "uppercase" }}>{f.label}</label>
                        <input type={f.type} value={editingDish[f.key]} onChange={e => setEditingDish(p => ({ ...p, [f.key]: e.target.value }))}
                          disabled={disabled}
                          style={{ width: "100%", background: "#0f0f13", border: "1px solid #3a3a4a", borderRadius: 8, padding: "10px 12px", color: "#e8e4dc", fontSize: 14, boxSizing: "border-box" }} />
                      </div>
                    );
                  })}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 11, fontFamily: "monospace", color: "#888", marginBottom: 8, textTransform: "uppercase" }}>Suitable for</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {MEAL_TYPES.map(t => {
                        const selected = normType(editingDish.type).includes(t);
                        return (
                          <button key={t} onClick={() => {
                            const cur = normType(editingDish.type);
                            setEditingDish(p => ({ ...p, type: selected ? cur.filter(x => x !== t) : [...cur, t] }));
                          }} style={{
                            background: selected ? "#c8b97a" : "#0f0f13", color: selected ? "#0f0f13" : "#888",
                            border: "1px solid #3a3a4a", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12,
                          }}>{MEAL_ICONS[t]} {t}</button>
                        );
                      })}
                    </div>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
                    <input type="checkbox" checked={editingDish.alwaysAvailable ?? false}
                      onChange={e => setEditingDish(p => ({ ...p, alwaysAvailable: e.target.checked }))}
                      style={{ width: 16, height: 16, accentColor: "#c8b97a", cursor: "pointer" }} />
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "#aaa" }}>Always available — no cooking needed</span>
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setEditingDish(null)} style={{ flex: 1, background: "none", border: "1px solid #3a3a4a", borderRadius: 8, padding: 10, color: "#888", cursor: "pointer" }}>Cancel</button>
                    <button onClick={() => saveEditDish(editingDish)} style={{ flex: 1, background: "#c8b97a", border: "none", borderRadius: 8, padding: 10, color: "#0f0f13", cursor: "pointer", fontWeight: "bold" }}>Save</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FRIDGE TAB */}
        {activeTab === "fridge" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#888" }}>{fridge.length} items in fridge</span>
            </div>

            {fridge.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "#444", fontFamily: "monospace" }}>🧊 Fridge is empty</div>
            )}

            {fridge.map(item => (
              <div key={item.id} style={{
                background: "#161620", border: "1px solid #2a3a3a", borderRadius: 10,
                padding: "14px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 15, marginBottom: 4 }}>🧊 {item.name}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#666" }}>{item.calories} kcal</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1e1e2e", borderRadius: 8, padding: "6px 10px" }}>
                    <button onClick={() => changeFridgePortions(item.id, -1)} style={{
                      background: "none", border: "none", color: "#f87171", cursor: "pointer",
                      fontSize: 18, lineHeight: 1, padding: 0, width: 20, textAlign: "center",
                    }}>−</button>
                    <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: "bold", color: "#4ade80", minWidth: 24, textAlign: "center" }}>
                      {item.portions}
                    </span>
                    <button onClick={() => changeFridgePortions(item.id, 1)} style={{
                      background: "none", border: "none", color: "#4ade80", cursor: "pointer",
                      fontSize: 18, lineHeight: 1, padding: 0, width: 20, textAlign: "center",
                    }}>+</button>
                  </div>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#555" }}>portion{item.portions > 1 ? "s" : ""}</span>
                  <button onClick={() => removeFridgeItem(item.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 18 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FREEZER TAB */}
        {activeTab === "freezer" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#888" }}>{freezer.length} items in freezer</span>
            </div>

            {freezer.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "#444", fontFamily: "monospace" }}>❄️ Freezer is empty</div>
            )}

            {freezer.map(item => (
              <div key={item.id} style={{
                background: "#161620", border: "1px solid #2a3a4a", borderRadius: 10,
                padding: "14px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 15, marginBottom: 4 }}>❄️ {item.name}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#666" }}>{item.calories} kcal</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1e1e2e", borderRadius: 8, padding: "6px 10px" }}>
                    <button onClick={() => changeFreezerPortions(item.id, -1)} style={{
                      background: "none", border: "none", color: "#f87171", cursor: "pointer",
                      fontSize: 18, lineHeight: 1, padding: 0, width: 20, textAlign: "center",
                    }}>−</button>
                    <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: "bold", color: "#7ab8c8", minWidth: 24, textAlign: "center" }}>
                      {item.portions}
                    </span>
                    <button onClick={() => changeFreezerPortions(item.id, 1)} style={{
                      background: "none", border: "none", color: "#4ade80", cursor: "pointer",
                      fontSize: 18, lineHeight: 1, padding: 0, width: 20, textAlign: "center",
                    }}>+</button>
                  </div>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#555" }}>portion{item.portions > 1 ? "s" : ""}</span>
                  <button onClick={() => moveToFridge(item)} style={{
                    background: "#1a1a24", border: "1px solid #2a3a3a", borderRadius: 6,
                    padding: "4px 10px", color: "#4ade80", cursor: "pointer", fontSize: 11,
                    fontFamily: "monospace", whiteSpace: "nowrap",
                  }}>→ fridge</button>
                  <button onClick={() => removeFreezerItem(item.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 18 }}>×</button>
                </div>
              </div>
            ))}

          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Nutrition</div>
              <div style={{ background: "#161620", border: "1px solid #2a2a3a", borderRadius: 10, padding: "20px 20px" }}>
                <label style={{ display: "block", fontSize: 11, fontFamily: "monospace", color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Daily calorie goal
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="number" min={500} max={9999}
                    value={settings.dailyCalories}
                    onChange={e => setSettings(p => ({ ...p, dailyCalories: parseInt(e.target.value) || p.dailyCalories }))}
                    style={{
                      width: 100, background: "#0f0f13", border: "1px solid #3a3a4a", borderRadius: 8,
                      padding: "10px 12px", color: "#c8b97a", fontSize: 18, fontFamily: "monospace",
                      fontWeight: "bold", textAlign: "center", outline: "none", boxSizing: "border-box",
                    }}
                  />
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: "#666" }}>kcal / day</span>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Data</div>
              <div style={{ background: "#161620", border: "1px solid #2a2a3a", borderRadius: 10, padding: "20px" }}>
                <p style={{ margin: "0 0 16px", fontFamily: "monospace", fontSize: 12, color: "#666", lineHeight: 1.6 }}>
                  Download a backup of your dishes, fridge, freezer, week plan and settings. Upload a previously saved backup to restore.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={handleExport} style={{
                    flex: 1, background: "#1e1e2e", border: "1px solid #3a3a4a", borderRadius: 8,
                    padding: "10px", color: "#c8b97a", cursor: "pointer", fontFamily: "monospace", fontSize: 12,
                  }}>download backup</button>
                  <label style={{
                    flex: 1, background: "#1e1e2e", border: "1px solid #3a3a4a", borderRadius: 8,
                    padding: "10px", color: "#888", cursor: "pointer", fontFamily: "monospace", fontSize: 12,
                    textAlign: "center",
                  }}>
                    upload backup
                    <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Meal selector modal */}
      {selectingFor && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex",
          alignItems: "flex-end", justifyContent: "center", zIndex: 200,
        }}>
          <div style={{
            background: "#1a1a24", border: "1px solid #3a3a4a", borderRadius: "16px 16px 0 0",
            padding: 24, width: "100%", maxWidth: 720, maxHeight: "70vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontWeight: "normal", color: "#c8b97a", fontSize: 15 }}>
                Choose {selectingFor.meal} for {selectingFor.day}
              </h3>
              <button onClick={() => setSelectingFor(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            {filteredOptions(selectingFor.meal).map(item => (
              <button key={`${item.source}-${item.id}`} onClick={() => assignMeal(selectingFor.day, selectingFor.meal, item)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  width: "100%", background: "#161620", border: "1px solid #2a2a3a", borderRadius: 10,
                  padding: "14px 16px", marginBottom: 8, cursor: "pointer", textAlign: "left",
                }}>
                <div>
                  <div style={{ color: "#e8e4dc", fontSize: 15 }}>
                    {item.source === "fridge" ? "🧊 " : ""}{item.name}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#666", marginTop: 3 }}>
                    {item.source === "fridge" ? `${item.portions} portion${item.portions > 1 ? "s" : ""} in fridge` : "always available"}
                  </div>
                </div>
                <span style={{ fontFamily: "monospace", fontSize: 13, color: calorieColor(item.calories) }}>{item.calories} kcal</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
