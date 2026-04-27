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

const SAMPLE_DISHES = [
  { id: 1, name: "Pasta Bolognese", calories: 650, servings: 3, type: "dinner" },
  { id: 2, name: "Chicken Stir Fry", calories: 520, servings: 2, type: "both" },
  { id: 3, name: "Lentil Soup", calories: 380, servings: 4, type: "lunch" },
  { id: 4, name: "Salmon & Veggies", calories: 480, servings: 2, type: "dinner" },
  { id: 5, name: "Greek Salad + Wrap", calories: 420, servings: 1, type: "lunch" },
  { id: 6, name: "Beef Stew", calories: 590, servings: 4, type: "dinner" },
  { id: 7, name: "Veggie Curry", calories: 440, servings: 3, type: "both" },
];

const SAMPLE_FREEZER = [
  { id: 1, name: "Frozen Lasagna", calories: 580, portions: 2 },
  { id: 2, name: "Soup Portions", calories: 320, portions: 3 },
  { id: 3, name: "Chili", calories: 490, portions: 2 },
];

const initialPlan = () => {
  const plan = {};
  DAYS.forEach(day => {
    plan[day] = { lunch: null, dinner: null, backupLunch: null, backupDinner: null };
  });
  return plan;
};

export default function MealPlanner() {
  // Dynamic: resets/changes week to week
  const [plan, setPlan] = useFileStorage("mp_plan", initialPlan);
  const [freezer, setFreezer] = useFileStorage("mp_freezer", SAMPLE_FREEZER);
  const [fridge, setFridge] = useFileStorage("mp_fridge", []);
  // Static: personal dish library, rarely changes
  const [dishes, setDishes] = useFileStorage("mp_dishes", SAMPLE_DISHES);
  const [activeTab, setActiveTab] = useState("plan");
  const [activeDay, setActiveDay] = useState(TODAY);
  const [showAddDish, setShowAddDish] = useState(false);
  const [selectingFor, setSelectingFor] = useState(null); // { day, meal, isBackup }
  const [newDish, setNewDish] = useState({ name: "", calories: "", servings: 1, type: "both", alwaysAvailable: false });
  const [cookInputs, setCookInputs] = useState({});
  const [cookedFeedback, setCookedFeedback] = useState({});
  const [editingDish, setEditingDish] = useState(null);

  const allOptions = [
    ...fridge.map(f => ({ ...f, source: "fridge", type: "both" })),
    ...dishes.map(d => ({ ...d, source: "dish" })),
    ...freezer.map(f => ({ ...f, source: "freezer", type: "both" })),
  ];

  const assignMeal = (day, meal, isBackup, item) => {
    if (item.source === "fridge") {
      setFridge(prev => prev
        .map(f => f.id === item.id ? { ...f, portions: f.portions - 1 } : f)
        .filter(f => f.portions > 0)
      );
    }
    setPlan(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [isBackup ? `backup${meal.charAt(0).toUpperCase() + meal.slice(1)}` : meal]: item
      }
    }));
    setSelectingFor(null);
  };

  const clearMeal = (day, meal, isBackup) => {
    const key = isBackup ? `backup${meal.charAt(0).toUpperCase() + meal.slice(1)}` : meal;
    const current = plan[day][key];
    if (current?.source === "fridge") {
      setFridge(prev => {
        const existing = prev.find(f => f.id === current.id);
        if (existing) {
          return prev.map(f => f.id === current.id ? { ...f, portions: f.portions + 1 } : f);
        }
        return [...prev, { id: current.id, dishId: current.dishId ?? null, name: current.name, calories: current.calories, portions: 1 }];
      });
    }
    setPlan(prev => ({ ...prev, [day]: { ...prev[day], [key]: null } }));
  };

  const completeDayMeals = (day) => {
    setPlan(prev => ({
      ...prev,
      [day]: { ...prev[day], lunch: null, dinner: null }
    }));
  };

  const getDayCalories = (day) => {
    const d = plan[day];
    const sum = (item) => item ? item.calories : 0;
    return sum(d.lunch) + sum(d.dinner);
  };

  const addDish = () => {
    if (!newDish.name || !newDish.calories) return;
    setDishes(prev => [...prev, { ...newDish, id: Date.now(), calories: parseInt(newDish.calories), servings: parseInt(newDish.servings) }]);
    setNewDish({ name: "", calories: "", servings: 1, type: "both" });
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
        ["lunch", "dinner", "backupLunch", "backupDinner"].forEach(key => {
          if (d[key]?.dishId === id) patch[key] = { ...d[key], calories, servings, type };
        });
        if (Object.keys(patch).length) updated[day] = { ...d, ...patch };
      });
      return updated;
    });
    setEditingDish(null);
  };

  const filteredOptions = (meal) => allOptions.filter(o =>
    (o.type === "both" || o.type === meal) &&
    (o.source === "fridge" || (o.source === "dish" && o.alwaysAvailable))
  );

  const calorieColor = (cal) => {
    if (cal === 0) return "#666";
    if (cal < 800) return "#4ade80";
    if (cal < 1200) return "#facc15";
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
            {["plan", "dishes", "fridge", "freezer"].map(tab => (
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
                {tab === "plan" ? "📅 Week" : tab === "dishes" ? "🍽 Dishes" : tab === "fridge" ? "🧊 Fridge" : "❄️ Freezer"}
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
                const hasData = plan[day].lunch || plan[day].dinner;
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
            {["lunch", "dinner"].map(meal => {
              const item = plan[activeDay][meal];
              const backup = plan[activeDay][`backup${meal.charAt(0).toUpperCase() + meal.slice(1)}`];
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
                      {meal === "lunch" ? "🌿 Lunch" : "🌙 Dinner"}
                    </span>
                    {item && <span style={{ fontSize: 12, color: calorieColor(item.calories), fontFamily: "monospace" }}>{item.calories} kcal</span>}
                  </div>

                  {/* Main meal */}
                  {item ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1e1e2e", borderRadius: 8, padding: "10px 14px" }}>
                      <div>
                        <div style={{ fontSize: 15 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace", marginTop: 2 }}>
                          {item.source === "dish" ? "✓ always available" : "🧊 fridge"}
                        </div>
                      </div>
                      <button onClick={() => clearMeal(activeDay, meal, false)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 18 }}>×</button>
                    </div>
                  ) : (
                    <button onClick={() => setSelectingFor({ day: activeDay, meal, isBackup: false })} style={{
                      width: "100%", background: "#1a1a24", border: "1px dashed #3a3a4a", borderRadius: 8,
                      padding: "12px", color: "#666", cursor: "pointer", fontSize: 13,
                    }}>+ Add {meal}</button>
                  )}
                </div>
              );
            })}

            {/* Day total + complete */}
            {(plan[activeDay].lunch || plan[activeDay].dinner) && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "#161620", border: "1px solid #2a2a3a", borderRadius: 8 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: "#888" }}>Day total: </span>
                  <span style={{ fontFamily: "monospace", fontSize: 16, color: calorieColor(getDayCalories(activeDay)), fontWeight: "bold" }}>
                    {getDayCalories(activeDay)} kcal
                  </span>
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

            {dishes.map(dish => (
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
                      {dish.calories} kcal · {dish.servings} serving{dish.servings > 1 ? "s" : ""} · {dish.type === "both" ? "lunch & dinner" : dish.type}
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
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 11, fontFamily: "monospace", color: "#888", marginBottom: 6, textTransform: "uppercase" }}>{f.label}</label>
                      <input type={f.type} value={newDish[f.key]} onChange={e => setNewDish(p => ({ ...p, [f.key]: e.target.value }))}
                        style={{ width: "100%", background: "#0f0f13", border: "1px solid #3a3a4a", borderRadius: 8, padding: "10px 12px", color: "#e8e4dc", fontSize: 14, boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 11, fontFamily: "monospace", color: "#888", marginBottom: 6, textTransform: "uppercase" }}>Suitable for</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["lunch", "dinner", "both"].map(t => (
                        <button key={t} onClick={() => setNewDish(p => ({ ...p, type: t }))} style={{
                          flex: 1, background: newDish.type === t ? "#c8b97a" : "#0f0f13",
                          color: newDish.type === t ? "#0f0f13" : "#888",
                          border: "1px solid #3a3a4a", borderRadius: 8, padding: "8px", cursor: "pointer", fontSize: 12,
                        }}>{t}</button>
                      ))}
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
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 11, fontFamily: "monospace", color: "#888", marginBottom: 6, textTransform: "uppercase" }}>{f.label}</label>
                      <input type={f.type} value={editingDish[f.key]} onChange={e => setEditingDish(p => ({ ...p, [f.key]: e.target.value }))}
                        style={{ width: "100%", background: "#0f0f13", border: "1px solid #3a3a4a", borderRadius: 8, padding: "10px 12px", color: "#e8e4dc", fontSize: 14, boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 11, fontFamily: "monospace", color: "#888", marginBottom: 6, textTransform: "uppercase" }}>Suitable for</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["lunch", "dinner", "both"].map(t => (
                        <button key={t} onClick={() => setEditingDish(p => ({ ...p, type: t }))} style={{
                          flex: 1, background: editingDish.type === t ? "#c8b97a" : "#0f0f13",
                          color: editingDish.type === t ? "#0f0f13" : "#888",
                          border: "1px solid #3a3a4a", borderRadius: 8, padding: "8px", cursor: "pointer", fontSize: 12,
                        }}>{t}</button>
                      ))}
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
                {selectingFor.isBackup ? "Choose backup" : "Choose"} {selectingFor.meal} for {selectingFor.day}
              </h3>
              <button onClick={() => setSelectingFor(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            {filteredOptions(selectingFor.meal).map(item => (
              <button key={`${item.source}-${item.id}`} onClick={() => assignMeal(selectingFor.day, selectingFor.meal, selectingFor.isBackup, item)}
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
