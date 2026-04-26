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
  // Static: personal dish library, rarely changes
  const [dishes, setDishes] = useFileStorage("mp_dishes", SAMPLE_DISHES);
  const [activeTab, setActiveTab] = useState("plan");
  const [activeDay, setActiveDay] = useState("Monday");
  const [showAddDish, setShowAddDish] = useState(false);
  const [showAddFreezer, setShowAddFreezer] = useState(false);
  const [selectingFor, setSelectingFor] = useState(null); // { day, meal, isBackup }
  const [newDish, setNewDish] = useState({ name: "", calories: "", servings: 1, type: "both" });
  const [newFreezer, setNewFreezer] = useState({ name: "", calories: "", portions: 1 });

  const allOptions = [
    ...dishes.map(d => ({ ...d, source: "dish" })),
    ...freezer.map(f => ({ ...f, source: "freezer", type: "both" }))
  ];

  const assignMeal = (day, meal, isBackup, item) => {
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
    setPlan(prev => ({ ...prev, [day]: { ...prev[day], [key]: null } }));
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

  const addFreezerItem = () => {
    if (!newFreezer.name || !newFreezer.calories) return;
    setFreezer(prev => [...prev, { ...newFreezer, id: Date.now(), calories: parseInt(newFreezer.calories), portions: parseInt(newFreezer.portions) }]);
    setNewFreezer({ name: "", calories: "", portions: 1 });
    setShowAddFreezer(false);
  };

  const removeFreezerItem = (id) => setFreezer(prev => prev.filter(f => f.id !== id));
  const removeDish = (id) => setDishes(prev => prev.filter(d => d.id !== id));

  const filteredOptions = (meal) => allOptions.filter(o => o.type === "both" || o.type === meal);

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
            {["plan", "dishes", "freezer"].map(tab => (
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
                {tab === "plan" ? "📅 Week" : tab === "dishes" ? "🍽 Dishes" : "❄️ Freezer"}
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
                    border: activeDay === day ? "none" : "1px solid #2a2a3a",
                    borderRadius: 8,
                    padding: "8px 12px",
                    cursor: "pointer",
                    flex: 1,
                    minWidth: 70,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: "bold" }}>{SHORT_DAYS[i]}</div>
                    {hasData && <div style={{ fontSize: 10, color: activeDay === day ? "#0f0f13" : calorieColor(cal), marginTop: 2 }}>{cal} kcal</div>}
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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1e1e2e", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 15 }}>{item.name}</div>
                        {item.servings > 1 && <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace", marginTop: 2 }}>Makes {item.servings} servings · {item.source === "freezer" ? "❄️ freezer" : "🍳 cook"}</div>}
                      </div>
                      <button onClick={() => clearMeal(activeDay, meal, false)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 18 }}>×</button>
                    </div>
                  ) : (
                    <button onClick={() => setSelectingFor({ day: activeDay, meal, isBackup: false })} style={{
                      width: "100%", background: "#1a1a24", border: "1px dashed #3a3a4a", borderRadius: 8,
                      padding: "12px", color: "#666", cursor: "pointer", fontSize: 13, marginBottom: 8,
                    }}>+ Add {meal}</button>
                  )}

                  {/* Backup meal */}
                  <div style={{ borderTop: "1px solid #2a2a3a", paddingTop: 10, marginTop: 4 }}>
                    <div style={{ fontSize: 10, color: "#555", fontFamily: "monospace", marginBottom: 6 }}>BACKUP OPTION</div>
                    {backup ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1a1a24", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontSize: 13, color: "#aaa" }}>{backup.name} <span style={{ color: "#666", fontSize: 11 }}>({backup.calories} kcal)</span></div>
                        <button onClick={() => clearMeal(activeDay, meal, true)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16 }}>×</button>
                      </div>
                    ) : (
                      <button onClick={() => setSelectingFor({ day: activeDay, meal, isBackup: true })} style={{
                        background: "none", border: "1px dashed #2a2a3a", borderRadius: 8,
                        padding: "6px 12px", color: "#555", cursor: "pointer", fontSize: 12, width: "100%",
                      }}>+ Add backup</button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Day total */}
            {(plan[activeDay].lunch || plan[activeDay].dinner) && (
              <div style={{ textAlign: "center", padding: "10px", background: "#161620", border: "1px solid #2a2a3a", borderRadius: 8 }}>
                <span style={{ fontFamily: "monospace", fontSize: 13, color: "#888" }}>Day total: </span>
                <span style={{ fontFamily: "monospace", fontSize: 16, color: calorieColor(getDayCalories(activeDay)), fontWeight: "bold" }}>
                  {getDayCalories(activeDay)} kcal
                </span>
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
                <div>
                  <div style={{ fontSize: 15, marginBottom: 4 }}>{dish.name}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#666" }}>
                    {dish.calories} kcal · {dish.servings} serving{dish.servings > 1 ? "s" : ""} · {dish.type === "both" ? "lunch & dinner" : dish.type}
                  </div>
                </div>
                <button onClick={() => removeDish(dish.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 18 }}>×</button>
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
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setShowAddDish(false)} style={{ flex: 1, background: "none", border: "1px solid #3a3a4a", borderRadius: 8, padding: 10, color: "#888", cursor: "pointer" }}>Cancel</button>
                    <button onClick={addDish} style={{ flex: 1, background: "#c8b97a", border: "none", borderRadius: 8, padding: 10, color: "#0f0f13", cursor: "pointer", fontWeight: "bold" }}>Add Dish</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FREEZER TAB */}
        {activeTab === "freezer" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#888" }}>{freezer.length} items in freezer</span>
              <button onClick={() => setShowAddFreezer(true)} style={{
                background: "#7ab8c8", color: "#0f0f13", border: "none", borderRadius: 8,
                padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: "bold",
              }}>+ Add Item</button>
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
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#666" }}>
                    {item.calories} kcal · {item.portions} portion{item.portions > 1 ? "s" : ""}
                  </div>
                </div>
                <button onClick={() => removeFreezerItem(item.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 18 }}>×</button>
              </div>
            ))}

            {showAddFreezer && (
              <div style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex",
                alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
              }}>
                <div style={{ background: "#1a1a24", border: "1px solid #3a3a4a", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380 }}>
                  <h3 style={{ margin: "0 0 20px", color: "#7ab8c8", fontWeight: "normal" }}>❄️ Add to Freezer</h3>
                  {[
                    { label: "Item name", key: "name", type: "text" },
                    { label: "Calories per portion", key: "calories", type: "number" },
                    { label: "Number of portions", key: "portions", type: "number" },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 11, fontFamily: "monospace", color: "#888", marginBottom: 6, textTransform: "uppercase" }}>{f.label}</label>
                      <input type={f.type} value={newFreezer[f.key]} onChange={e => setNewFreezer(p => ({ ...p, [f.key]: e.target.value }))}
                        style={{ width: "100%", background: "#0f0f13", border: "1px solid #3a3a4a", borderRadius: 8, padding: "10px 12px", color: "#e8e4dc", fontSize: 14, boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                    <button onClick={() => setShowAddFreezer(false)} style={{ flex: 1, background: "none", border: "1px solid #3a3a4a", borderRadius: 8, padding: 10, color: "#888", cursor: "pointer" }}>Cancel</button>
                    <button onClick={addFreezerItem} style={{ flex: 1, background: "#7ab8c8", border: "none", borderRadius: 8, padding: 10, color: "#0f0f13", cursor: "pointer", fontWeight: "bold" }}>Add Item</button>
                  </div>
                </div>
              </div>
            )}
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
                    {item.source === "freezer" ? "❄️ " : ""}{item.name}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#666", marginTop: 3 }}>
                    {item.source === "freezer" ? `${item.portions} portions` : `${item.servings} servings`}
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
