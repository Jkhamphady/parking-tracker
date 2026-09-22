import React, { useState, useEffect } from 'react';
import { 
  Car, 
  MapPin, 
  Check, 
  Plus, 
  Trash2, 
  RefreshCw, 
  User, 
  Users, 
  Globe, 
  Smartphone, 
  History, 
  ChevronRight, 
  LogOut, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp 
} from 'firebase/firestore';

// Standard Firebase Configuration Template
// Note: When deploying independently, replace this config with your own free Firebase project keys from https://console.firebase.google.com/
const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForStandaloneDeployment",
  authDomain: "parking-tracker-app.firebaseapp.com",
  projectId: "parking-tracker-app",
  storageBucket: "parking-tracker-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Default state data
const DEFAULT_CARS = [
  { id: 'c1', name: 'Infiniti', color: 'bg-amber-500' },
  { id: 'c2', name: 'Nissan', color: 'bg-blue-500' }
];

const DEFAULT_FLOORS = [2, 3, 4, 5, 6, 7, 8];

export default function ParkingTrackerApp() {
  // Sync Mode: 'solo' (Local Storage) or 'shared' (Firebase Cloud Sync)
  const [syncMode, setSyncMode] = useState(() => {
    return localStorage.getItem('pt_sync_mode') || 'solo';
  });

  // Identity / Room settings
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('pt_user_name') || 'Husband';
  });
  const [roomCode, setRoomCode] = useState(() => {
    return localStorage.getItem('pt_room_code') || 'OUR-GARAGE';
  });
  const [roomInput, setRoomInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('tracker'); // 'tracker', 'history', 'settings'

  // Parking state data
  const [cars, setCars] = useState(() => {
    const saved = localStorage.getItem('pt_cars');
    return saved ? JSON.parse(saved) : DEFAULT_CARS;
  });

  const [floors, setFloors] = useState(() => {
    const saved = localStorage.getItem('pt_floors');
    return saved ? JSON.parse(saved) : DEFAULT_FLOORS;
  });

  // Map of carId -> floorNumber
  const [assignments, setAssignments] = useState(() => {
    const saved = localStorage.getItem('pt_assignments');
    return saved ? JSON.parse(saved) : { c1: 4, c2: 7 };
  });

  const [selectedCarId, setSelectedCarId] = useState('c1');
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('pt_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [newCarName, setNewCarName] = useState('');
  const [newFloorNum, setNewFloorNum] = useState('');

  // Persist solo data locally whenever state updates
  useEffect(() => {
    localStorage.setItem('pt_sync_mode', syncMode);
    localStorage.setItem('pt_user_name', userName);
    localStorage.setItem('pt_room_code', roomCode);
    
    if (syncMode === 'solo') {
      localStorage.setItem('pt_cars', JSON.stringify(cars));
      localStorage.setItem('pt_floors', JSON.stringify(floors));
      localStorage.setItem('pt_assignments', JSON.stringify(assignments));
      localStorage.setItem('pt_history', JSON.stringify(history));
    }
  }, [syncMode, userName, roomCode, cars, floors, assignments, history]);

  // Real-time Firestore synchronization in Shared Mode
  useEffect(() => {
    if (syncMode !== 'shared' || !roomCode) {
      setIsConnected(false);
      return;
    }

    const docRef = doc(db, 'garages', roomCode.toUpperCase().trim());

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.cars) setCars(data.cars);
        if (data.floors) setFloors(data.floors);
        if (data.assignments) setAssignments(data.assignments);
        if (data.history) setHistory(data.history);
        setIsConnected(true);
      } else {
        // Initialize doc on Firebase if it doesn't exist
        setDoc(docRef, {
          cars: DEFAULT_CARS,
          floors: DEFAULT_FLOORS,
          assignments: { c1: 4, c2: 7 },
          history: [],
          updatedAt: serverTimestamp()
        });
        setIsConnected(true);
      }
    }, (err) => {
      console.warn("Cloud sync connection error:", err);
      setIsConnected(false);
    });

    return () => unsubscribe();
  }, [syncMode, roomCode]);

  // Helper to update state (either Firestore or local)
  const updateAppData = async (newAssignments, historyEntry) => {
    const updatedHistory = [historyEntry, ...history].slice(0, 30);
    setAssignments(newAssignments);
    setHistory(updatedHistory);

    if (syncMode === 'shared' && roomCode) {
      try {
        const docRef = doc(db, 'garages', roomCode.toUpperCase().trim());
        await updateDoc(docRef, {
          assignments: newAssignments,
          history: arrayUnion(historyEntry),
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.error("Cloud push failed:", e);
      }
    }
  };

  // Toggle parking for a car on a specific floor
  const handleFloorClick = (floorNum) => {
    const currentFloor = assignments[selectedCarId];
    const carObj = cars.find(c => c.id === selectedCarId);
    if (!carObj) return;

    let newAssignments = { ...assignments };
    let actionText = '';

    if (currentFloor === floorNum) {
      // Unpark/Vacate
      delete newAssignments[selectedCarId];
      actionText = `vacated Floor ${floorNum}`;
    } else {
      // Park at floor
      newAssignments[selectedCarId] = floorNum;
      actionText = `parked at Floor ${floorNum}`;
    }

    const historyEntry = {
      id: Date.now().toString(),
      carName: carObj.name,
      action: actionText,
      user: userName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    updateAppData(newAssignments, historyEntry);
  };

  // Add a new car option
  const handleAddCar = (e) => {
    e.preventDefault();
    if (!newCarName.trim()) return;
    const colors = ['bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500'];
    const newCar = {
      id: 'c_' + Date.now(),
      name: newCarName.trim(),
      color: colors[cars.length % colors.length]
    };
    const updatedCars = [...cars, newCar];
    setCars(updatedCars);
    setNewCarName('');

    if (syncMode === 'shared' && roomCode) {
      const docRef = doc(db, 'garages', roomCode.toUpperCase().trim());
      updateDoc(docRef, { cars: updatedCars });
    }
  };

  // Add a new floor number
  const handleAddFloor = (e) => {
    e.preventDefault();
    const num = parseInt(newFloorNum);
    if (isNaN(num) || floors.includes(num)) return;
    const updatedFloors = [...floors, num].sort((a, b) => a - b);
    setFloors(updatedFloors);
    setNewFloorNum('');

    if (syncMode === 'shared' && roomCode) {
      const docRef = doc(db, 'garages', roomCode.toUpperCase().trim());
      updateDoc(docRef, { floors: updatedFloors });
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomInput.trim()) {
      setRoomCode(roomInput.trim().toUpperCase());
      setSyncMode('shared');
      setRoomInput('');
    }
  };

  const activeCar = cars.find(c => c.id === selectedCarId) || cars[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans max-w-md mx-auto shadow-2xl overflow-hidden border-x border-slate-800/80">
      
      {/* HEADER BAR */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-20 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Car className="w-6 h-6 text-indigo-400" />
            Parking Update
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {syncMode === 'shared' ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Shared: {roomCode} ({userName})
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                <Smartphone className="w-3.5 h-3.5" />
                Solo Mode (Local Device)
              </span>
            )}
          </p>
        </div>

        {/* Sync Mode Toggle Button */}
        <button 
          onClick={() => setSyncMode(syncMode === 'solo' ? 'shared' : 'solo')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all ${
            syncMode === 'shared' 
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20' 
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {syncMode === 'shared' ? <Users className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
          {syncMode === 'shared' ? 'Shared' : 'Solo'}
        </button>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 space-y-5 pb-24">

        {/* TAB 1: PARKING TRACKER */}
        {activeTab === 'tracker' && (
          <div className="space-y-5">
            
            {/* CAR SELECTOR STRIP */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                Step 1: Select Vehicle
              </span>
              <div className="grid grid-cols-2 gap-2">
                {cars.map((car) => {
                  const isSelected = selectedCarId === car.id;
                  const assignedFloor = assignments[car.id];
                  return (
                    <button
                      key={car.id}
                      onClick={() => setSelectedCarId(car.id)}
                      className={`relative p-3 rounded-xl flex flex-col text-left transition-all border ${
                        isSelected 
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-950/50' 
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-semibold text-sm truncate">{car.name}</span>
                        <div className={`w-2.5 h-2.5 rounded-full ${car.color}`} />
                      </div>

                      <div className="text-xs text-slate-400">
                        {assignedFloor ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> Floor {assignedFloor}
                          </span>
                        ) : (
                          'Not parked'
                        )}
                      </div>

                      {isSelected && (
                        <div className="absolute top-2 right-2 text-indigo-400">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FLOOR SELECTOR LIST */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Step 2: Tap Floor Number for {activeCar?.name}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {floors.map((floorNum) => {
                  // Find cars parked on this floor
                  const carsHere = cars.filter(c => assignments[c.id] === floorNum);
                  const isCurrentCarHere = assignments[selectedCarId] === floorNum;

                  return (
                    <button
                      key={floorNum}
                      onClick={() => handleFloorClick(floorNum)}
                      className={`w-full p-4 rounded-xl flex items-center justify-between transition-all border text-left ${
                        isCurrentCarHere 
                          ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-md' 
                          : carsHere.length > 0 
                            ? 'bg-slate-900 border-slate-700/80 text-slate-200' 
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-base ${
                          isCurrentCarHere 
                            ? 'bg-amber-500 text-slate-950' 
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {floorNum}
                        </div>
                        
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-100 text-base">
                            Floor {floorNum}
                          </span>
                          <div className="flex flex-wrap gap-1.5 mt-0.5">
                            {carsHere.length > 0 ? (
                              carsHere.map(c => (
                                <span 
                                  key={c.id} 
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium text-slate-950 ${c.color}`}
                                >
                                  {c.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500">Empty</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Check Indicator */}
                      <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                        isCurrentCarHere 
                          ? 'bg-amber-500 border-amber-500 text-slate-950' 
                          : 'border-slate-700 text-transparent'
                      }`}>
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVITY LOG */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-1">
              Live Activity History
            </h2>

            {history.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
                <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No activity recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                        {item.user ? item.user.substring(0, 2).toUpperCase() : 'ME'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          <span className="font-semibold text-white">{item.carName}</span> {item.action}
                        </p>
                        <p className="text-xs text-slate-500">{item.user} • {item.timestamp}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SETTINGS & CO-EDIT MANAGEMENT */}
        {activeTab === 'settings' && (
          <div className="space-y-5">
            
            {/* SYNC SETTINGS CARD */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                Shared Co-Editing Mode
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Your Display Name</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Husband / Wife"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Active Garage Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="e.g. OUR-GARAGE"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-slate-100 uppercase focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => setSyncMode('shared')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
                    >
                      Connect
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-400 space-y-1">
                  <p className="font-medium text-slate-300">How to sync with your wife:</p>
                  <p>1. Type the same Garage Code on both phones.</p>
                  <p>2. Tap <strong>Connect</strong> on both devices.</p>
                  <p>3. Parking changes will sync live in real time!</p>
                </div>
              </div>
            </div>

            {/* CUSTOMIZE VEHICLES & FLOORS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
              <h2 className="text-sm font-semibold text-slate-200">Customize Cars & Floors</h2>

              {/* Add Car */}
              <form onSubmit={handleAddCar} className="flex gap-2">
                <input
                  type="text"
                  value={newCarName}
                  onChange={(e) => setNewCarName(e.target.value)}
                  placeholder="New vehicle name"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </form>

              {/* Add Floor */}
              <form onSubmit={handleAddFloor} className="flex gap-2">
                <input
                  type="number"
                  value={newFloorNum}
                  onChange={(e) => setNewFloorNum(e.target.value)}
                  placeholder="New floor number"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </form>
            </div>

          </div>
        )}

      </main>

      {/* BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-2 flex justify-around z-20">
        <button
          onClick={() => setActiveTab('tracker')}
          className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'tracker' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-5 h-5" />
          Tracker
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'history' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-5 h-5" />
          Log
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'settings' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-5 h-5" />
          Co-Edit
        </button>
      </nav>

    </div>
  );
}
