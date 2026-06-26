import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db, 
  googleProvider,
  handleFirestoreError,
  OperationType
} from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  updateProfile,
  User
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { 
  Flame, 
  Clock, 
  AlertTriangle, 
  CheckSquare, 
  Plus, 
  Trash2, 
  Edit, 
  Mic, 
  MicOff, 
  Send, 
  User as UserIcon, 
  LogOut, 
  Sun, 
  Moon, 
  TrendingUp, 
  Calendar, 
  ShieldAlert, 
  Brain, 
  Upload, 
  Sparkles, 
  Layers, 
  Award, 
  RefreshCw, 
  FileText, 
  Smile, 
  Volume2, 
  VolumeX, 
  ChevronRight, 
  HelpCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ==========================================
// TYPES & INTERFACES
// ==========================================
interface Task {
  id: string;
  name: string;
  deadline: string;
  priority: 'low' | 'medium' | 'high';
  estimatedHours: number;
  completedHours: number;
  completed: boolean;
  completedAt?: string | null;
  riskScore?: number;
  successChance?: number;
  riskFactors?: string[];
  aiRecommendation?: string;
}

interface Habit {
  id: string;
  name: string;
  streak: number;
  history: { [date: string]: boolean }; // YYYY-MM-DD -> completed
  createdAt: string;
}

interface UserProfile {
  name: string;
  email: string;
  username: string;
  photoURL: string;
  xp: number;
  level: number;
  theme: 'dark' | 'light';
  googleCalendarConnected: boolean;
}

interface ScheduleItem {
  time: string;
  taskName: string;
  duration: string;
  type: 'focus' | 'break' | 'flex' | 'review';
  advice: string;
}

interface ScannedEvent {
  name: string;
  type: string;
  deadline: string;
  priority: 'low' | 'medium' | 'high';
  estimatedHours: number;
}

// ==========================================
// FLOATING GLOWING ORBS CANVAS BACKGROUND
// ==========================================
const AmbientBackground: React.FC<{ theme: 'dark' | 'light' }> = ({ theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Orb parameters
    const orbCount = 12;
    const orbs: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
    }[] = [];

    const colors = theme === 'dark' 
      ? [
          'rgba(99, 102, 241, 0.12)',  // Indigo
          'rgba(168, 85, 247, 0.12)',  // Purple
          'rgba(236, 72, 153, 0.08)',  // Pink
          'rgba(16, 185, 129, 0.08)',  // Neon Emerald
        ]
      : [
          'rgba(99, 102, 241, 0.04)',  // Indigo
          'rgba(168, 85, 247, 0.04)',  // Purple
          'rgba(147, 197, 253, 0.06)',  // Soft Blue
          'rgba(110, 231, 183, 0.04)',  // Soft Mint
        ];

    for (let i = 0; i < orbCount; i++) {
      orbs.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 200 + 100,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      orbs.forEach((orb) => {
        orb.x += orb.vx;
        orb.y += orb.vy;

        // Bounce
        if (orb.x - orb.radius < 0 || orb.x + orb.radius > width) orb.vx *= -1;
        if (orb.y - orb.radius < 0 || orb.y + orb.radius > height) orb.vy *= -1;

        const gradient = ctx.createRadialGradient(
          orb.x,
          orb.y,
          0,
          orb.x,
          orb.y,
          orb.radius
        );
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 transition-colors duration-500"
    />
  );
};

// ==========================================
// AUTH ERROR MAPPING HELPER
// ==========================================
const mapAuthError = (err: any): string => {
  const code = err?.code || '';
  const msg = err?.message || '';
  
  if (code === 'auth/operation-not-allowed') {
    return 'The requested sign-in method is not enabled in your Firebase Console. Please make sure both "Email/Password" and "Google" are enabled under Authentication ➔ Sign-in method.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (code === 'auth/invalid-email') {
    return 'The email address is invalid. Please check your spelling.';
  }
  if (code === 'auth/weak-password') {
    return 'The password is too weak. It must be at least 6 characters long.';
  }
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'No account found or incorrect credentials. If you do not have an account, would you like to create a new account?';
  }
  if (code === 'auth/user-not-found') {
    return 'No account found with this email or username. Would you like to create a new account?';
  }
  if (code === 'auth/popup-blocked') {
    return 'The sign-in popup was blocked by your browser. We will try redirecting you instead, or you can allow popups for this site.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'The Google sign-in window was closed before completing. Please try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return `This domain is not authorized for OAuth in Firebase. Please add this domain (${window.location.hostname}) to the "Authorized Domains" list in Firebase Console ➔ Authentication ➔ Settings.`;
  }
  
  // Fallbacks
  if (msg.includes('operation-not-allowed')) {
    return 'The requested sign-in method is not enabled in your Firebase Console. Please enable "Email/Password" and "Google" under Authentication ➔ Sign-in method.';
  }
  if (msg.includes('unauthorized-domain')) {
    return `This domain is not authorized for OAuth in Firebase. Please add this domain (${window.location.hostname}) to the "Authorized Domains" list in Firebase Console.`;
  }
  if (msg.includes('popup-blocked')) {
    return 'Google login popup was blocked. Trying redirect login...';
  }
  
  return err.message || 'Authentication failed. Please try again.';
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    username: '',
    photoURL: '',
    xp: 0,
    level: 1,
    theme: 'dark',
    googleCalendarConnected: false
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'forecast' | 'habits' | 'scanner' | 'chat' | 'profile'>('dashboard');

  // Auth Modal States
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  // Stats
  const [availableHours, setAvailableHours] = useState(8);

  // AI Scheduling & Chat State
  const [aiSchedule, setAiSchedule] = useState<ScheduleItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string; time: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Scan & Upload
  const [scannedEvents, setScannedEvents] = useState<ScannedEvent[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Rescue Plan Modal State
  const [rescueTask, setRescueTask] = useState<Task | null>(null);
  const [rescuePlanText, setRescuePlanText] = useState<string>('');
  const [rescueLoading, setRescueLoading] = useState(false);

  // CRUD Task Modal States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskFormName, setTaskFormName] = useState('');
  const [taskFormDeadline, setTaskFormDeadline] = useState('');
  const [taskFormPriority, setTaskFormPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskFormEstHours, setTaskFormEstHours] = useState(4);
  const [taskFormCompHours, setTaskFormCompHours] = useState(0);

  // New Habit Input State
  const [newHabitName, setNewHabitName] = useState('');

  // Weekly Scroll Report Modal State
  const [weeklyReport, setWeeklyReport] = useState<{ grade: string; score: number; strengths: string[]; growth: string[]; guidance: string } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Web Speech API
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognitionRef = useRef<any>(null);

  // Custom audio elements for gamification and notification soundscapes
  const playSound = (type: 'levelUp' | 'taskSuccess' | 'notification') => {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);

    if (type === 'taskSuccess') {
      // Ninja sword slice / chimes (Quick rising pitch)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.3);
      gain.gain.setValueAtTime(0.2, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
      osc.start();
      osc.stop(context.currentTime + 0.3);
    } else if (type === 'levelUp') {
      // Majestic Level up fanfare
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(261.63, context.currentTime); // C4
      osc.frequency.setValueAtTime(329.63, context.currentTime + 0.1); // E4
      osc.frequency.setValueAtTime(392.00, context.currentTime + 0.2); // G4
      osc.frequency.setValueAtTime(523.25, context.currentTime + 0.3); // C5
      gain.gain.setValueAtTime(0.3, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.6);
      osc.start();
      osc.stop(context.currentTime + 0.6);
    } else if (type === 'notification') {
      // Dual high alerts
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, context.currentTime);
      osc.frequency.setValueAtTime(987.77, context.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.4);
      osc.start();
      osc.stop(context.currentTime + 0.4);
    }
  };

  // Trigger Local System Notification with dynamic severity
  const triggerNotification = (title: string, body: string, urgency: 'low' | 'high' = 'low') => {
    playSound('notification');
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/assets/icon_alert.png'
      });
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(transcript);
        handleSendChat(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Handle Google Sign-In redirect result
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("Successfully logged in via Google Redirect:", result.user);
        }
      })
      .catch((err: any) => {
        console.error("Google Redirect login failed:", err);
        setAuthError(mapAuthError(err));
      });
  }, []);

  // Handle Authentication status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Real-time Firestore sync of user profile
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile({
              name: data.name || user.displayName || 'Ninja Master',
              email: data.email || user.email || '',
              username: data.username || 'ninja_warrior',
              photoURL: data.photoURL || user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
              xp: data.xp || 0,
              level: data.level || 1,
              theme: data.theme || 'dark',
              googleCalendarConnected: data.googleCalendarConnected || false
            });
          } else {
            // Document doesn't exist yet, seed profile
            const initialProfile = {
              name: user.displayName || 'Ninja Apprentice',
              email: user.email || '',
              username: 'apprentice_' + user.uid.substring(0, 5),
              photoURL: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
              xp: 100,
              level: 1,
              theme: 'dark',
              googleCalendarConnected: false
            };
            setDoc(userDocRef, initialProfile).catch((err) => {
              handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
            });
            setProfile(initialProfile);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        });

        // Real-time sync of tasks
        const tasksQuery = query(collection(db, 'users', user.uid, 'tasks'), orderBy('deadline', 'asc'));
        const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
          const list: Task[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as Task);
          });
          setTasks(list);

          // Check if any task is high risk on load and fire browser notification
          list.forEach(t => {
            const hoursLeft = (new Date(t.deadline).getTime() - new Date().getTime()) / 3600000;
            if (!t.completed && hoursLeft > 0 && hoursLeft < 24) {
              triggerNotification(
                `🚨 PANIC ALERT: ${t.name}`,
                `Deadline is in less than ${Math.round(hoursLeft)} hours! Strike now before it gets late.`,
                'high'
              );
            }
          });
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/tasks`);
        });

        // Real-time sync of habits
        const habitsQuery = query(collection(db, 'users', user.uid, 'habits'));
        const unsubscribeHabits = onSnapshot(habitsQuery, (snapshot) => {
          const list: Habit[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as Habit);
          });
          setHabits(list);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/habits`);
        });

        setLoading(false);
        return () => {
          unsubscribeUser();
          unsubscribeTasks();
          unsubscribeHabits();
        };
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Toggle Theme helper
  const handleToggleTheme = async () => {
    const nextTheme = profile.theme === 'dark' ? 'light' : 'dark';
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { theme: nextTheme });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
      }
    } else {
      setProfile(prev => ({ ...prev, theme: nextTheme }));
    }
  };

  // Google Calendar toggle
  const handleConnectGoogleCalendar = async () => {
    if (!currentUser) return;
    const nextState = !profile.googleCalendarConnected;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { googleCalendarConnected: nextState });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
    triggerNotification(
      nextState ? "📅 Google Calendar Connected" : "📅 Google Calendar Disconnected",
      nextState ? "Deadlines will now synchronize automatically across schedules." : "Calendar synchronization suspended."
    );
  };

  // Speech Recognition control
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported on your browser. Please try Chrome or Edge.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Text-to-Speech response
  const speakText = (text: string) => {
    if (!ttsEnabled) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_\-]/g, ''); // strip markdown
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  // ==========================================
  // XP GAMIFICATION ENGINE
  // ==========================================
  const addXP = async (amount: number) => {
    if (!currentUser) return;
    const newXP = profile.xp + amount;
    const newLevel = Math.floor(newXP / 500) + 1;
    const levelUp = newLevel > profile.level;

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        xp: newXP,
        level: newLevel
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    }

    if (levelUp) {
      playSound('levelUp');
      triggerNotification("🔥 SHINOBI RANK UP!", `Congratulations! You have reached Level ${newLevel}! Keep beating those deadlines!`, 'high');
    }
  };

  // ==========================================
  // AUTH PROCEDURES
  // ==========================================
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (isSignUp) {
      if (!authName || !authEmail || !authUsername || !authPassword || !authConfirmPassword) {
        setAuthError('All fields are required.');
        return;
      }
      if (authPassword !== authConfirmPassword) {
        setAuthError('Passwords do not match.');
        return;
      }
      try {
        // Check username uniqueness (case-insensitive checking / trimming)
        const targetUsername = authUsername.trim().toLowerCase();
        let isUsernameTaken = false;
        try {
          const usersRef = collection(db, 'users');
          const usernameQ = query(usersRef, where('username', '==', targetUsername));
          const usernameSnapshot = await getDocs(usernameQ);
          if (!usernameSnapshot.empty) {
            isUsernameTaken = true;
          }
        } catch (usernameErr: any) {
          console.warn("Username uniqueness check bypassed due to restrictive database rules:", usernameErr);
          // Do not block sign-up if the check fails due to permission constraints.
        }
        
        if (isUsernameTaken) {
          setAuthError('This username is already taken. Please select a different name_ninja.');
          return;
        }

        const cred = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        await updateProfile(cred.user, { displayName: authName });
        await setDoc(doc(db, 'users', cred.user.uid), {
          name: authName,
          email: authEmail.trim(),
          username: targetUsername,
          photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          xp: 100,
          level: 1,
          theme: 'dark',
          googleCalendarConnected: false
        });

        // Seed some awesome default initial tasks and habits for superb onboarding!
        const defaultTasks = [
          { name: '🔥 Complete Deadline Ninja Tour', deadline: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], priority: 'high', estimatedHours: 1, completedHours: 0, completed: false, riskScore: 20 },
          { name: '📚 Learn 5-Minute Procrastination Shield technique', deadline: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0], priority: 'medium', estimatedHours: 2, completedHours: 0, completed: false, riskScore: 10 }
        ];
        for (const t of defaultTasks) {
          try {
            await addDoc(collection(db, 'users', cred.user.uid, 'tasks'), t);
          } catch (taskErr) {
            console.error("Error seeding default task:", taskErr);
          }
        }

        const defaultHabits = [
          { name: '🔥 Daily Study Streak', streak: 1, history: { [new Date().toISOString().split('T')[0]]: true }, createdAt: new Date().toISOString() },
          { name: '💪 Gym Streak', streak: 0, history: {}, createdAt: new Date().toISOString() }
        ];
        for (const h of defaultHabits) {
          try {
            await addDoc(collection(db, 'users', cred.user.uid, 'habits'), h);
          } catch (habitErr) {
            console.error("Error seeding default habit:", habitErr);
          }
        }

      } catch (err: any) {
        console.error("Signup error details:", err);
        setAuthError(mapAuthError(err));
      }
    } else {
      if (!authEmail || !authPassword) {
        setAuthError('Email/Password required.');
        return;
      }
      try {
        let emailToSignIn = authEmail.trim();
        let accountExists = true;
        let databaseCheckCompleted = false;

        try {
          const isEmailFormat = emailToSignIn.includes('@');
          const usersRef = collection(db, 'users');
          
          let q;
          if (isEmailFormat) {
            q = query(usersRef, where('email', '==', emailToSignIn));
          } else {
            q = query(usersRef, where('username', '==', emailToSignIn));
          }
          
          const querySnapshot = await getDocs(q);
          databaseCheckCompleted = true;
          if (querySnapshot.empty) {
            accountExists = false;
          } else {
            accountExists = true;
            if (!isEmailFormat) {
              const userData = querySnapshot.docs[0].data() as any;
              if (userData && userData.email) {
                emailToSignIn = userData.email;
              }
            }
          }
        } catch (checkErr: any) {
          console.warn("Account existence precheck bypassed due to rules/permissions:", checkErr);
          // If we can't query the database, we can still let them try to log in directly if they entered an email.
          // If they entered a username and we couldn't resolve it, we'll notify them.
          if (!emailToSignIn.includes('@')) {
            setAuthError('Cannot resolve username due to strict database security. Please log in using your registered email address instead.');
            return;
          }
        }

        if (databaseCheckCompleted && !accountExists) {
          setAuthError('No account found under this email or username. Would you like to create a new account?');
          return;
        }

        await signInWithEmailAndPassword(auth, emailToSignIn, authPassword);
      } catch (err: any) {
        console.error("Auth submit error:", err);
        setAuthError(mapAuthError(err));
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Popup sign-in failed:", err);
      const errCode = err?.code;
      // If it's blocked by browser/iframe/sandbox constraints (popup-blocked, popup-closed, unauthorized-domain, etc.)
      if (
        errCode === 'auth/popup-blocked' || 
        errCode === 'auth/popup-closed-by-user' ||
        errCode === 'auth/unauthorized-domain' ||
        err.message?.includes('iframe') ||
        err.message?.includes('popup') ||
        err.message?.includes('security-error') ||
        err.message?.includes('closed')
      ) {
        try {
          console.log("Attempting signInWithRedirect fallback...");
          setAuthError('Sign-in popup was blocked or failed in sandbox. Redirecting to Google Login...');
          await signInWithRedirect(auth, googleProvider);
        } catch (redirErr: any) {
          console.error("Google Redirect sign-in failed:", redirErr);
          setAuthError(mapAuthError(redirErr) + ' (Redirect login also failed. Please sign in using Email/Password.)');
        }
      } else {
        setAuthError(mapAuthError(err));
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!authEmail) {
      setAuthError('Enter your email in the field to reset password.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, authEmail);
      setForgotPasswordSent(true);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to send reset email');
    }
  };

  // ==========================================
  // TASK CRUD OPERATIONS
  // ==========================================
  const handleOpenAddTask = () => {
    setEditingTask(null);
    setTaskFormName('');
    setTaskFormDeadline(new Date().toISOString().split('T')[0]);
    setTaskFormPriority('medium');
    setTaskFormEstHours(4);
    setTaskFormCompHours(0);
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskFormName(task.name);
    setTaskFormDeadline(task.deadline);
    setTaskFormPriority(task.priority);
    setTaskFormEstHours(task.estimatedHours);
    setTaskFormCompHours(task.completedHours);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // Calculate initial risk score based on simple client rules or wait for AI sync
    const hoursLeft = (new Date(taskFormDeadline).getTime() - new Date().getTime()) / 3600000;
    const progress = (taskFormCompHours / taskFormEstHours) * 100;
    let initialRisk = 50;
    if (hoursLeft < 24) initialRisk = 90;
    else if (hoursLeft < 72) initialRisk = 70;
    if (progress > 50) initialRisk -= 20;
    if (progress === 100) initialRisk = 0;
    initialRisk = Math.max(0, Math.min(100, initialRisk));

    const taskData = {
      name: taskFormName,
      deadline: taskFormDeadline,
      priority: taskFormPriority,
      estimatedHours: taskFormEstHours,
      completedHours: taskFormCompHours,
      completed: taskFormCompHours >= taskFormEstHours,
      riskScore: initialRisk,
      completedAt: taskFormCompHours >= taskFormEstHours ? new Date().toISOString() : null
    };

    if (editingTask) {
      const docRef = doc(db, 'users', currentUser.uid, 'tasks', editingTask.id);
      await updateDoc(docRef, taskData);

      // Award XP on complete transitions
      if (!editingTask.completed && taskData.completed) {
        await addXP(100);
        playSound('taskSuccess');
        triggerNotification("🎉 Deadlines Beat!", `Splendid skill! You completed "${taskFormName}" and earned +100 XP!`);
      }
    } else {
      await addDoc(collection(db, 'users', currentUser.uid, 'tasks'), taskData);
      await addXP(30);
      triggerNotification("🗡️ Task Registered", `Added to-do: "${taskFormName}" (+30 XP).`);
    }

    setIsTaskModalOpen(false);
  };

  const handleDeleteTask = async (id: string, name: string) => {
    if (!currentUser) return;
    await deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', id));
    triggerNotification("🗑️ To-do Dismissed", `Deleted task: "${name}"`);
  };

  const handleQuickProgress = async (task: Task, increment: number) => {
    if (!currentUser) return;
    const newComp = Math.min(task.estimatedHours, Math.max(0, task.completedHours + increment));
    const completedNow = newComp >= task.estimatedHours;
    
    await updateDoc(doc(db, 'users', currentUser.uid, 'tasks', task.id), {
      completedHours: newComp,
      completed: completedNow,
      completedAt: completedNow ? new Date().toISOString() : null,
      riskScore: completedNow ? 0 : task.riskScore
    });

    if (!task.completed && completedNow) {
      await addXP(100);
      playSound('taskSuccess');
      triggerNotification("🎉 Deadlines Beat!", `Beautiful timing! Completed "${task.name}" and gained +100 XP!`);
    }
  };

  // ==========================================
  // HABITS OPERATIONS
  // ==========================================
  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newHabitName) return;

    await addDoc(collection(db, 'users', currentUser.uid, 'habits'), {
      name: newHabitName,
      streak: 0,
      history: {},
      createdAt: new Date().toISOString()
    });

    setNewHabitName('');
    triggerNotification("🔥 New Habit Embedded", `Your journey for "${newHabitName}" has begun!`);
  };

  const toggleHabitDay = async (habit: Habit, dateStr: string) => {
    if (!currentUser) return;

    const newHistory = { ...habit.history };
    const currentVal = !!newHistory[dateStr];
    newHistory[dateStr] = !currentVal;

    // Calculate Streak based on consecutive days
    let currentStreak = habit.streak;
    if (newHistory[dateStr]) {
      currentStreak += 1;
      await addXP(20);
    } else {
      currentStreak = Math.max(0, currentStreak - 1);
    }

    await updateDoc(doc(db, 'users', currentUser.uid, 'habits', habit.id), {
      history: newHistory,
      streak: currentStreak
    });
  };

  // ==========================================
  // AI SERVER INTEGRATIONS
  // ==========================================

  // 1. Generate Hourly AI Schedule
  const triggerGenerateSchedule = async () => {
    if (!currentUser) return;
    setScheduleLoading(true);
    try {
      const activeTasks = tasks.filter(t => !t.completed);
      const res = await fetch('/api/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: activeTasks,
          availableHours: availableHours,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });
      const data = await res.json();
      if (data.schedule) {
        setAiSchedule(data.schedule);
        await addXP(40);
        triggerNotification("🥋 Tactical Schedule Active", "Your Day Schedule has been calibrated by the Deadline Ninja.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to the Ninja Scheduler. Confirm GEMINI_API_KEY is active in setting.");
    } finally {
      setScheduleLoading(false);
    }
  };

  // 2. Chat & Voice Assistant
  const handleSendChat = async (inputVal?: string) => {
    const textToSend = inputVal || chatInput;
    if (!textToSend.trim() || !currentUser) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user' as const, text: textToSend, time: timeStr };
    setChatMessages(prev => [...prev, userMsg]);
    if (!inputVal) setChatInput('');
    setChatLoading(true);

    try {
      const activeTasks = tasks.filter(t => !t.completed);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg].map(m => ({ role: m.role, text: m.text })),
          tasks: activeTasks
        })
      });
      const data = await response.json();
      if (data.text) {
        const aiMsg = { role: 'assistant' as const, text: data.text, time: timeStr };
        setChatMessages(prev => [...prev, aiMsg]);
        speakText(data.text);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  // 3. AI Predictive Risk Forecast
  const triggerForecastAndSync = async () => {
    if (!currentUser || tasks.length === 0) return;
    setScanLoading(true);
    try {
      const activeTasks = tasks.filter(t => !t.completed);
      const res = await fetch('/api/risk-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: activeTasks,
          habitStats: habits.map(h => ({ name: h.name, streak: h.streak }))
        })
      });
      const data = await res.json();
      if (data.forecasts) {
        // Map forecasts and write risk updates in-place to tasks
        for (const fc of data.forecasts) {
          const matched = tasks.find(t => t.id === fc.taskId);
          if (matched) {
            await updateDoc(doc(db, 'users', currentUser.uid, 'tasks', fc.taskId), {
              riskScore: fc.riskScore,
              successChance: fc.successChance,
              riskFactors: fc.whyFactors,
              aiRecommendation: fc.aiRecommendation
            });
          }
        }
        triggerNotification("📊 Forecast Updated", "Risk scores and success chances recalculated via Gemini.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScanLoading(false);
    }
  };

  // 4. Multi-modal Screenshot / Email scanner
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  };

  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      await scanDocument(base64String, file.type);
    };
    reader.readAsDataURL(file);
  };

  const scanDocument = async (base64Data: string, mimeType: string) => {
    setScanLoading(true);
    try {
      const response = await fetch('/api/scan-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: mimeType
        })
      });
      const data = await response.json();
      if (data.events) {
        setScannedEvents(data.events);
        triggerNotification("🔮 Vision Scan Finished", `Found ${data.events.length} target deadlines. Confirm to enlist them.`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed scanning image. Make sure base64 and API Keys are verified.");
    } finally {
      setScanLoading(false);
    }
  };

  const addScannedEventToTasks = async (event: ScannedEvent, index: number) => {
    if (!currentUser) return;
    await addDoc(collection(db, 'users', currentUser.uid, 'tasks'), {
      name: event.name,
      deadline: event.deadline,
      priority: event.priority,
      estimatedHours: event.estimatedHours,
      completedHours: 0,
      completed: false,
      riskScore: 30,
      completedAt: null
    });

    // Remove from the temporary scan list
    setScannedEvents(prev => prev.filter((_, i) => i !== index));
    await addXP(40);
    triggerNotification("🗡️ Task Enlisted", `Successfully added "${event.name}" (+40 XP).`);
  };

  // 5. Generate Weekly productivity report
  const triggerWeeklyReport = async () => {
    if (!currentUser) return;
    setReportLoading(true);
    try {
      const res = await fetch('/api/productivity-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasksHistory: tasks.map(t => ({ name: t.name, completed: t.completed, hours: t.completedHours })),
          habitStreaks: habits.map(h => ({ name: h.name, streak: h.streak })),
          username: profile.name
        })
      });
      const data = await res.json();
      if (data) {
        setWeeklyReport(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  // 6. Generate Task Rescue Plan (for Panic Mode or High Risk Alerts)
  const triggerRescuePlan = async (task: Task) => {
    setRescueTask(task);
    setRescueLoading(true);
    try {
      const ai = auth; // just check auth
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            text: `Construct a 3-step dynamic Tactical rescue checklist for task "${task.name}". Remaining hours required: ${task.estimatedHours - task.completedHours}h. Deadline: ${task.deadline}. Offer specific ninja focus strategy.`
          }],
          tasks: [task]
        })
      });
      const data = await res.json();
      if (data.text) {
        setRescuePlanText(data.text);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRescueLoading(false);
    }
  };

  // ==========================================
  // COMPUTED METRICS
  // ==========================================
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const tasksAtRisk = tasks.filter(t => !t.completed && (t.riskScore || 0) > 60).length;
  const upcomingDeadlines = tasks.filter(t => {
    if (t.completed) return false;
    const days = (new Date(t.deadline).getTime() - new Date().getTime()) / 86400000;
    return days >= 0 && days <= 3;
  }).length;

  const averageCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Find the highest risk active task
  const highestRiskTask = tasks
    .filter(t => !t.completed)
    .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))[0] || null;

  // For Panic view
  const panicTask = tasks
    .filter(t => !t.completed)
    .find(t => {
      const hoursLeft = (new Date(t.deadline).getTime() - new Date().getTime()) / 3600000;
      return hoursLeft > 0 && hoursLeft < 36; // triggers when a deadline is under 36 hours
    });

  // Helper date lists for Habit heatmaps (past 7 days)
  const getPastWeekDates = () => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().split('T')[0]);
    }
    return arr;
  };
  const weekDates = getPastWeekDates();

  // ==========================================
  // VIEW RENDER LOGIC
  // ==========================================
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <AmbientBackground theme="dark" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full flex items-center justify-center"
          >
            <Layers className="w-8 h-8 text-indigo-400" />
          </motion.div>
          <p className="text-indigo-200 font-medium tracking-widest text-sm animate-pulse uppercase">
            Calibrating Shadow Focus...
          </p>
        </div>
      </div>
    );
  }

  // Not logged in: Show gorgeous Landing / Auth Interface
  if (!currentUser) {
    return (
      <div className={`min-h-screen transition-colors duration-500 flex flex-col ${profile.theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <AmbientBackground theme={profile.theme} />

        {/* Global Nav Bar */}
        <header className="relative z-10 border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-600 rounded-lg text-white font-bold shadow-lg shadow-indigo-500/20">
              ⚔️
            </span>
            <span className="font-extrabold text-xl tracking-tight">Deadline <span className="text-indigo-500">Ninja</span></span>
          </div>
          <button 
            id="theme-toggle"
            onClick={handleToggleTheme}
            className={`p-2.5 rounded-lg border transition-all ${profile.theme === 'dark' ? 'border-slate-800 text-yellow-400 hover:bg-slate-900' : 'border-slate-200 text-indigo-600 hover:bg-slate-100'}`}
          >
            {profile.theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>



        {/* Hero & Login Area split */}
        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Landing Side */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> AI-Powered Shadow Tactics
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-none">
              Never Miss a <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500">
                Deadline Again.
              </span>
            </h1>
            <p className="text-lg opacity-80 leading-relaxed max-w-lg">
              Don't miss deadlines. Beat them. An AI-powered productivity companion that predicts risks, prioritizes tasks, and creates action plans before deadlines become emergencies.
            </p>

            {/* Showcase Badges */}
            <div className="grid grid-cols-3 gap-4 pt-4 max-w-md">
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-1">
                <Brain className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-bold">Predict Risk</span>
              </div>
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-1">
                <Clock className="w-5 h-5 text-purple-400" />
                <span className="text-xs font-bold">Hourly Plans</span>
              </div>
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-1">
                <Upload className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold">File Scanner</span>
              </div>
            </div>
          </div>

          {/* Login/Signup Screen */}
          <div id="auth-panel" className="w-full max-w-md mx-auto">
            <div className={`p-8 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all ${profile.theme === 'dark' ? 'bg-slate-900/80 border-slate-800 shadow-indigo-500/5' : 'bg-white/90 border-slate-100 shadow-slate-200/50'}`}>
              
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">
                  {forgotPasswordMode ? 'Recover Secret Keys' : isSignUp ? 'Create Shinobi Account' : 'Welcome to the Dojo'}
                </h2>
                <p className="text-xs opacity-70 mt-1">
                  {forgotPasswordMode ? 'Enter registered Email to get a recovery link' : isSignUp ? 'Embark on the elite deadline beat program' : 'Authenticate to sync tactical assets'}
                </p>
              </div>

              {authError && (
                <div className={`mb-5 p-4 border rounded-xl text-left transition-all ${
                  authError.includes('create a new account') || authError.includes('No account found')
                    ? (profile.theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-200' : 'bg-indigo-50 border-indigo-100 text-slate-800')
                    : (profile.theme === 'dark' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-700')
                }`}>
                  <div className="flex items-start gap-2.5">
                    <span className="text-base mt-0.5">
                      {authError.includes('create a new account') || authError.includes('No account found') ? '💡' : '⚠️'}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold leading-relaxed">
                        {authError}
                      </p>
                      {(authError.includes('create a new account') || authError.includes('No account found')) && (
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsSignUp(true);
                              setAuthError('');
                              // Auto-populate name/username with part of the email
                              if (authEmail && authEmail.includes('@')) {
                                const localPart = authEmail.split('@')[0];
                                const formattedName = localPart.charAt(0).toUpperCase() + localPart.slice(1);
                                setAuthName(formattedName);
                                setAuthUsername(`${localPart.toLowerCase()}_ninja`);
                              } else if (authEmail) {
                                setAuthUsername(authEmail.toLowerCase().endsWith('_ninja') ? authEmail.toLowerCase() : `${authEmail.toLowerCase()}_ninja`);
                                setAuthEmail('');
                              }
                            }}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-md shadow-indigo-500/15 transition-all cursor-pointer"
                          >
                            Sign Up
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuthError('')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                              profile.theme === 'dark' 
                                ? 'border-white/10 hover:bg-white/5 text-white' 
                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {forgotPasswordSent ? (
                <div className="space-y-4 text-center py-6">
                  <div className="text-indigo-400 text-4xl">📬</div>
                  <h3 className="font-bold text-lg">Recovery Link Sent</h3>
                  <p className="text-xs opacity-70">Check your inbox. Secure password update link has been delivered.</p>
                  <button
                    onClick={() => {
                      setForgotPasswordMode(false);
                      setForgotPasswordSent(false);
                    }}
                    className="text-xs font-bold text-indigo-500 hover:underline"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : forgotPasswordMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-75">Your Account Email</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. shadow@dojo.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className={`w-full p-3 rounded-lg border text-sm transition-all outline-none ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500 text-slate-900'}`}
                    />
                  </div>
                  <button
                    onClick={handleForgotPassword}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/20 text-sm transition-all"
                  >
                    Send Recovery Email
                  </button>
                  <div className="text-center">
                    <button
                      onClick={() => setForgotPasswordMode(false)}
                      className="text-xs font-semibold text-indigo-500 hover:underline"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {isSignUp && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-75">Real Name</label>
                          <input
                            type="text"
                            required
                            placeholder="Name"
                            value={authName}
                            onChange={(e) => setAuthName(e.target.value)}
                            className={`w-full p-3 rounded-lg border text-sm transition-all outline-none ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500 text-slate-900'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-75">Username</label>
                          <input
                            type="text"
                            required
                            placeholder="name_ninja"
                            value={authUsername}
                            onChange={(e) => setAuthUsername(e.target.value)}
                            className={`w-full p-3 rounded-lg border text-sm transition-all outline-none ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500 text-slate-900'}`}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-75">Email/Username</label>
                    <input
                      type="email"
                      required
                      placeholder="Enter Email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className={`w-full p-3 rounded-lg border text-sm transition-all outline-none ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500 text-slate-900'}`}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold uppercase tracking-wider opacity-75">Secret Password</label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => setForgotPasswordMode(true)}
                          className="text-xs text-indigo-500 hover:underline"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className={`w-full p-3 rounded-lg border text-sm transition-all outline-none ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500 text-slate-900'}`}
                    />
                  </div>

                  {isSignUp && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-75">Confirm Password</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={authConfirmPassword}
                        onChange={(e) => setAuthConfirmPassword(e.target.value)}
                        className={`w-full p-3 rounded-lg border text-sm transition-all outline-none ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500 text-slate-900'}`}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/20 text-sm transition-all cursor-pointer"
                  >
                    {isSignUp ? 'Activate Account' : 'Authenticate Credentials'}
                  </button>

                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-white/5"></div>
                    <span className="flex-shrink mx-4 text-xs opacity-50">OR</span>
                    <div className="flex-grow border-t border-white/5"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className={`w-full py-3 border rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white/5 transition-all cursor-pointer ${profile.theme === 'dark' ? 'border-slate-800 text-white' : 'border-slate-200 text-slate-700'}`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.14-5.136 4.14A5.67 5.67 0 0 1 8.32 12.87a5.67 5.67 0 0 1 5.67-5.67c1.47 0 2.805.56 3.82 1.48l3.1-3.1A10.032 10.032 0 0 0 13.99 2.5a10.02 10.02 0 0 0-10 10.02 10.02 10.02 0 0 0 10 10.02c5.56 0 10.12-4.05 10.12-10.02 0-.6-.05-1.18-.15-1.74H12.24Z"/>
                    </svg>
                    Google Authentication
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-xs font-bold text-indigo-500 hover:underline"
                    >
                      {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

        </main>
      </div>
    );
  }

  // ==========================================
  // LOGGED IN COMPANION VIEW
  // ==========================================
  return (
    <div className={`min-h-screen transition-colors duration-500 flex flex-col ${profile.theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <AmbientBackground theme={profile.theme} />

      {/* Global Dashboard Header */}
      <header className="relative z-10 border-b border-white/5 px-6 py-4 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-600 rounded-lg text-white font-bold">
              ⚔️
            </span>
            <span className="font-extrabold text-lg tracking-tight">Deadline <span className="text-indigo-500">Ninja</span></span>
          </div>

          {/* XP & Level Widget */}
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-slate-900/60 border border-white/5 rounded-full text-xs">
            <div className="flex items-center gap-1 font-bold text-yellow-400">
              <Award className="w-4 h-4 text-yellow-400" />
              LVL {profile.level}
            </div>
            <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${(profile.xp % 500) / 5}%` }}
              />
            </div>
            <span className="text-[10px] opacity-75 font-semibold">{(profile.xp % 500)}/500 XP</span>
          </div>
        </div>

        {/* Header Right */}
        <div className="flex items-center gap-3">
          {/* Quick Connect Google Cal status */}
          <button
            onClick={handleConnectGoogleCalendar}
            className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${profile.googleCalendarConnected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-white/5 opacity-50 text-slate-300'}`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{profile.googleCalendarConnected ? "Synced" : "Sync GCal"}</span>
          </button>

          {/* Theme Switch */}
          <button 
            id="theme-toggle-dashboard"
            onClick={handleToggleTheme}
            className={`p-2 rounded-lg border transition-all ${profile.theme === 'dark' ? 'border-slate-800 text-yellow-400 hover:bg-slate-900' : 'border-slate-200 text-indigo-600 hover:bg-slate-100'}`}
          >
            {profile.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Profile Avatar click */}
          <button
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-2 hover:opacity-80 transition-all border border-white/10 rounded-full p-0.5"
          >
            <img 
              src={profile.photoURL || undefined} 
              alt="avatar" 
              className="w-8 h-8 rounded-full object-cover"
            />
          </button>

          <button
            onClick={() => signOut(auth)}
            className="p-2 hover:bg-red-500/10 border border-slate-800 text-red-400 rounded-lg transition-all"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-6 gap-6">
        
        {/* Responsive Dashboard Left / Sidebar Navigation */}
        <nav className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-3 md:pb-0 border-b md:border-b-0 border-white/5">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Layers },
            { id: 'forecast', label: 'AI Prediction', icon: TrendingUp },
            { id: 'habits', label: 'Habit Tracker', icon: Flame },
            { id: 'scanner', label: 'Email Scanner', icon: Upload },
            { id: 'chat', label: 'Ask Ninja', icon: Brain },
            { id: 'profile', label: 'Shinobi Config', icon: UserIcon }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all shrink-0 cursor-pointer ${
                  isSelected 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' 
                    : profile.theme === 'dark' 
                      ? 'text-slate-400 hover:bg-slate-900/50 hover:text-white' 
                      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Dynamic Panel Content Area */}
        <main className="flex-1 min-w-0">
          
          {/* ==========================================
              PANIC MODE BANNER (UNDER 36 HOURS DEADLINE)
             ========================================== */}
          {panicTask && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-red-600/35 via-orange-600/25 to-red-600/10 border border-red-500/40 shadow-lg shadow-red-500/5"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex gap-3">
                  <div className="p-3 bg-red-600 rounded-xl text-white">
                    <ShieldAlert className="w-6 h-6 animate-bounce" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-extrabold tracking-widest text-red-400 animate-pulse">🚨 Deadline Rescue Activated</span>
                    <h3 className="font-extrabold text-lg text-white mt-0.5">{panicTask.name}</h3>
                    <p className="text-xs text-red-200 mt-1 flex items-center gap-1.5 font-semibold">
                      <Clock className="w-3.5 h-3.5" /> 
                      Time Remaining: {Math.max(1, Math.round((new Date(panicTask.deadline).getTime() - new Date().getTime()) / 3600000))} hours!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] opacity-75 block text-white font-semibold">Recovery Chance</span>
                    <span className="font-black text-2xl text-red-400">{100 - (panicTask.riskScore || 70)}%</span>
                  </div>
                  <button
                    onClick={() => triggerRescuePlan(panicTask)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-lg shadow-md transition-all cursor-pointer"
                  >
                    Generate Rescue Plan
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            
            {/* ==========================================
                1. DASHBOARD TAB
               ========================================== */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Greeting */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight">Welcome Back, {profile.name} 👋</h2>
                    <p className="text-xs opacity-70 mt-0.5">Let's check your target lists and slice procrastination risks.</p>
                  </div>

                  {/* Available Hours Modifier */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-white/5 rounded-xl text-xs font-bold">
                    <span>Hours Available Today:</span>
                    <input 
                      type="number"
                      min="1"
                      max="24"
                      value={availableHours}
                      onChange={(e) => setAvailableHours(Number(e.target.value))}
                      className="w-12 p-1 text-center bg-slate-950 border border-slate-800 text-indigo-400 rounded-md outline-none"
                    />
                  </div>
                </div>

                {/* Stat cards row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Productivity Score", val: `${averageCompletionRate}%`, desc: "Avg Task complete rate", color: "text-emerald-400", icon: TrendingUp },
                    { label: "Tasks at Risk", val: tasksAtRisk, desc: "High AI Risk Scores", color: "text-red-400", icon: AlertTriangle },
                    { label: "Upcoming Deadlines", val: upcomingDeadlines, desc: "Due within 3 days", color: "text-yellow-400", icon: Clock },
                    { label: "Hours Engaged", val: `${tasks.reduce((sum, t) => sum + (t.completed ? 0 : t.estimatedHours - t.completedHours), 0)}h`, desc: "Total required effort", color: "text-indigo-400", icon: Layers }
                  ].map((s, idx) => {
                    const SIcon = s.icon;
                    return (
                      <div 
                        key={idx}
                        className={`p-4 rounded-2xl border ${profile.theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs opacity-70 font-semibold">{s.label}</span>
                          <SIcon className={`w-4 h-4 ${s.color}`} />
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-2xl font-black">{s.val}</span>
                        </div>
                        <p className="text-[10px] opacity-60 mt-1 font-semibold">{s.desc}</p>
                      </div>
                    );
                  })}
                </div>

                {/* AI ALERT CARD & SCHEDULER SIDE BY SIDE */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: High Risk task & AI Generated schedule */}
                  <div className="lg:col-span-8 space-y-6">
                    
                    {/* High Risk detected alert widget */}
                    {highestRiskTask && (
                      <div className={`p-5 rounded-2xl border ${profile.theme === 'dark' ? 'bg-gradient-to-r from-red-950/20 to-slate-900/60 border-red-500/20' : 'bg-red-50/50 border-red-100 shadow-sm'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-3">
                            <span className="p-2 bg-red-600/10 border border-red-500/20 text-red-500 rounded-xl font-bold">🚨</span>
                            <div>
                              <h4 className="font-bold text-sm text-red-400">High Risk Detected</h4>
                              <h3 className="font-extrabold text-lg mt-0.5">{highestRiskTask.name}</h3>
                              <p className="text-xs opacity-75 mt-1">
                                Risk Score: <span className="font-bold text-red-500">{highestRiskTask.riskScore}%</span> • {highestRiskTask.estimatedHours - highestRiskTask.completedHours}h remaining to completion.
                              </p>
                              {highestRiskTask.aiRecommendation && (
                                <p className="text-xs bg-slate-950/40 p-2.5 rounded-lg border border-white/5 text-slate-300 mt-2.5">
                                  <strong>Ninja Strategy:</strong> {highestRiskTask.aiRecommendation}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => triggerRescuePlan(highestRiskTask)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-lg shadow-md shrink-0 cursor-pointer"
                          >
                            Generate Plan
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Smart task list block */}
                    <div className={`p-6 rounded-2xl border ${profile.theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-extrabold text-lg">Smart Task List</h3>
                          <p className="text-xs opacity-70">Add active targets and track deadline status.</p>
                        </div>
                        <button
                          onClick={handleOpenAddTask}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-lg flex items-center gap-1 shadow-lg shadow-indigo-600/10 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Task</span>
                        </button>
                      </div>

                      {tasks.length === 0 ? (
                        <div className="text-center py-10 opacity-60">
                          <p className="text-sm font-semibold">No tasks recorded. Seed onboarding or add custom tasks!</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-white/5 opacity-70 text-slate-400">
                                <th className="pb-3 font-semibold">Task</th>
                                <th className="pb-3 font-semibold">Priority</th>
                                <th className="pb-3 font-semibold">Deadline</th>
                                <th className="pb-3 font-semibold">Progress</th>
                                <th className="pb-3 font-semibold">Risk %</th>
                                <th className="pb-3 text-right font-semibold">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {tasks.map((task) => {
                                const hoursLeft = (new Date(task.deadline).getTime() - new Date().getTime()) / 3600000;
                                const isPanic = hoursLeft > 0 && hoursLeft < 36 && !task.completed;
                                return (
                                  <tr key={task.id} className="group hover:bg-white/5 transition-all">
                                    <td className="py-3.5 pr-2 font-bold max-w-xs truncate">
                                      <div className="flex items-center gap-2">
                                        <button 
                                          onClick={() => handleQuickProgress(task, task.completed ? -task.estimatedHours : task.estimatedHours)}
                                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${task.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-600 group-hover:border-indigo-500'}`}
                                        >
                                          {task.completed && "✓"}
                                        </button>
                                        <span className={task.completed ? 'line-through opacity-50 font-medium' : 'text-slate-200'}>
                                          {task.name}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-3.5">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        task.priority === 'high' 
                                          ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                                          : task.priority === 'medium' 
                                            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' 
                                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      }`}>
                                        {task.priority}
                                      </span>
                                    </td>
                                    <td className="py-3.5 text-slate-400 font-semibold">{task.deadline}</td>
                                    <td className="py-3.5">
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                          <div 
                                            className="bg-indigo-500 h-full rounded-full"
                                            style={{ width: `${(task.completedHours / task.estimatedHours) * 100}%` }}
                                          />
                                        </div>
                                        <span className="text-[10px] opacity-75 font-bold">
                                          {task.completedHours}/{task.estimatedHours}h
                                        </span>
                                        <button 
                                          onClick={() => handleQuickProgress(task, 1)}
                                          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white/5 rounded text-indigo-400"
                                          title="Add 1 Hour"
                                        >
                                          +1h
                                        </button>
                                      </div>
                                    </td>
                                    <td className="py-3.5 font-black">
                                      {task.completed ? (
                                        <span className="text-emerald-400">0%</span>
                                      ) : (
                                        <span className={
                                          (task.riskScore || 30) > 70 
                                            ? 'text-red-500' 
                                            : (task.riskScore || 30) > 40 
                                              ? 'text-yellow-500' 
                                              : 'text-emerald-500'
                                        }>
                                          {task.riskScore || 30}%
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3.5 text-right space-x-1.5">
                                      <button 
                                        onClick={() => handleOpenEditTask(task)}
                                        className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-white"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteTask(task.id, task.name)}
                                        className="p-1 hover:bg-red-500/10 rounded text-slate-400 hover:text-red-400"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: AI Hourly Schedule Generator */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className={`p-5 rounded-2xl border flex flex-col h-full ${profile.theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-extrabold text-base flex items-center gap-1.5">
                            <Brain className="w-4.5 h-4.5 text-indigo-400" />
                            Tactical Hour-Schedule
                          </h3>
                          <p className="text-[10px] opacity-70 mt-0.5">Let Gemini structure a micro-timeline of active tasks.</p>
                        </div>
                        <button
                          onClick={triggerGenerateSchedule}
                          disabled={scheduleLoading || tasks.length === 0}
                          className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-md shadow-indigo-600/10 cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${scheduleLoading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      {scheduleLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
                          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-[10px] opacity-70 animate-pulse">Running Gemini tactical matrix...</p>
                        </div>
                      ) : aiSchedule.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed border-white/10 rounded-xl">
                          <Calendar className="w-8 h-8 text-slate-500 mb-2" />
                          <h4 className="font-bold text-xs">No active schedule</h4>
                          <p className="text-[10px] opacity-60 max-w-xs mt-1">Tap the refresh icon above to trigger the hourly AI scheduler.</p>
                        </div>
                      ) : (
                        <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[450px]">
                          {aiSchedule.map((item, index) => (
                            <div 
                              key={index} 
                              className={`p-3 rounded-xl border border-white/5 relative pl-4 ${
                                item.type === 'focus' 
                                  ? 'bg-indigo-500/5 border-l-4 border-l-indigo-500' 
                                  : item.type === 'break' 
                                    ? 'bg-emerald-500/5 border-l-4 border-l-emerald-500' 
                                    : 'bg-slate-950/50 border-l-4 border-l-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] opacity-60 font-black tracking-wider uppercase">{item.time}</span>
                                <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                                  item.type === 'focus' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'
                                }`}>{item.type}</span>
                              </div>
                              <h4 className="font-extrabold text-sm mt-1">{item.taskName}</h4>
                              <p className="text-[10px] opacity-80 mt-1 italic font-medium">💬 {item.advice}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {/* ==========================================
                2. AI PREDICTIVE FORECAST TAB
               ========================================== */}
            {activeTab === 'forecast' && (
              <motion.div
                key="forecast"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight">Deadline Forecast 📊 AI Prediction</h2>
                    <p className="text-xs opacity-70 mt-0.5">Gemini analyzes your task scopes, deadlines, streaks, and predicts procrastination chances.</p>
                  </div>
                  <button
                    onClick={triggerForecastAndSync}
                    disabled={scanLoading || tasks.length === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${scanLoading ? 'animate-spin' : ''}`} />
                    <span>Trigger Forecast</span>
                  </button>
                </div>

                {tasks.length === 0 ? (
                  <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl opacity-60">
                    <p className="text-sm font-semibold">Please register tasks first to begin forecast generation.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {tasks.map(task => (
                      <div 
                        key={task.id}
                        className={`p-5 rounded-2xl border transition-all ${
                          task.completed 
                            ? 'bg-slate-950/40 border-slate-900/50 opacity-65' 
                            : profile.theme === 'dark' 
                              ? 'bg-slate-900/60 border-slate-800 hover:border-indigo-500/20' 
                              : 'bg-white border-slate-100 shadow-sm hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] opacity-60 font-bold uppercase tracking-wider">{task.priority} Priority</span>
                            <h3 className="font-extrabold text-lg mt-0.5">{task.name}</h3>
                            <p className="text-xs opacity-75 mt-1">Deadline: {task.deadline}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] opacity-70 block font-semibold">Success likelihood</span>
                            <span className={`font-black text-2xl ${
                              task.completed 
                                ? 'text-emerald-400' 
                                : (task.successChance || 70) > 75 
                                  ? 'text-emerald-400' 
                                  : (task.successChance || 70) > 45 
                                    ? 'text-yellow-400' 
                                    : 'text-red-400'
                            }`}>
                              {task.completed ? '100%' : `${task.successChance || 70}%`}
                            </span>
                          </div>
                        </div>

                        {/* Expandable Risk Factors */}
                        {!task.completed && (
                          <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                            <span className="text-xs font-extrabold flex items-center gap-1 text-indigo-400">
                              <Brain className="w-3.5 h-3.5" /> Why? AI Risk Factors
                            </span>
                            <ul className="list-disc list-inside text-xs opacity-80 pl-1 space-y-1">
                              {task.riskFactors && task.riskFactors.length > 0 ? (
                                task.riskFactors.map((f, i) => <li key={i}>{f}</li>)
                              ) : (
                                <>
                                  <li>Time relative to scope complexity is tight</li>
                                  <li>Requires daily incremental effort</li>
                                </>
                              )}
                            </ul>
                            {task.aiRecommendation && (
                              <div className="bg-slate-950/40 border border-white/5 p-2.5 rounded-lg text-xs mt-3">
                                <strong>Tactical Action:</strong> {task.aiRecommendation}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ==========================================
                3. HABIT TRACKER TAB
               ========================================== */}
            {activeTab === 'habits' && (
              <motion.div
                key="habits"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight">Dojo Habit Streak Trackers</h2>
                    <p className="text-xs opacity-70 mt-0.5">Solidify study and execution habits with responsive calendars & heatmaps.</p>
                  </div>

                  <form onSubmit={handleAddHabit} className="flex gap-2 w-full sm:w-auto">
                    <input 
                      type="text"
                      required
                      placeholder="e.g. 🔥 Study Streak"
                      value={newHabitName}
                      onChange={(e) => setNewHabitName(e.target.value)}
                      className={`px-3 py-2 rounded-xl border text-xs outline-none focus:border-indigo-500 ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-md cursor-pointer"
                    >
                      Embed Habit
                    </button>
                  </form>
                </div>

                {habits.length === 0 ? (
                  <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl opacity-60">
                    <p className="text-sm font-semibold">No habits tracked yet. Embed your first streak to start!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {habits.map((habit) => (
                      <div 
                        key={habit.id}
                        className={`p-5 rounded-2xl border ${profile.theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-extrabold text-lg flex items-center gap-1.5">
                            <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
                            {habit.name}
                          </h3>
                          <span className="text-xs bg-orange-500/10 text-orange-400 font-black px-2.5 py-1 rounded-full border border-orange-500/20">
                            🔥 {habit.streak} DAY STREAK
                          </span>
                        </div>

                        {/* Map Calendar View for past 7 days */}
                        <div className="mt-6">
                          <span className="text-xs opacity-70 block mb-2 font-bold uppercase tracking-wider">Consistency Heatmap (7 Days)</span>
                          <div className="grid grid-cols-7 gap-2">
                            {weekDates.map((dateStr) => {
                              const done = !!habit.history[dateStr];
                              const dayLabel = new Date(dateStr).toLocaleDateString([], { weekday: 'short' });
                              const isToday = dateStr === new Date().toISOString().split('T')[0];
                              return (
                                <button
                                  key={dateStr}
                                  onClick={() => toggleHabitDay(habit, dateStr)}
                                  className={`p-2.5 rounded-xl flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                                    done 
                                      ? 'bg-orange-500 border-orange-600 text-white' 
                                      : isToday 
                                        ? 'bg-white/5 border-orange-500/40 text-orange-400' 
                                        : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-white/5'
                                  }`}
                                  title={`${dateStr} (${done ? 'Completed' : 'Missed'})`}
                                >
                                  <span className="text-[10px] font-black">{dayLabel}</span>
                                  <span className="text-[9px] opacity-75">{dateStr.slice(8, 10)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ==========================================
                4. MULTI-MODAL SCREENSHOT SCANNER TAB
               ========================================== */}
            {activeTab === 'scanner' && (
              <motion.div
                key="scanner"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">AI Email/Screenshot Scanner</h2>
                  <p className="text-xs opacity-70 mt-0.5">Upload a photo/screenshot of an email, syllabus, or calendar grid. Gemini scans & extracts tasks automatically.</p>
                </div>

                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center min-h-[220px] ${
                    dragActive 
                      ? 'border-indigo-500 bg-indigo-500/5' 
                      : profile.theme === 'dark' 
                        ? 'border-slate-800 hover:border-slate-700 bg-slate-900/40' 
                        : 'border-slate-200 hover:border-slate-300 bg-white shadow-sm'
                  }`}
                >
                  <input
                    type="file"
                    id="file-scanner"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="file-scanner" className="cursor-pointer flex flex-col items-center">
                    <div className="p-4 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-2xl mb-4">
                      <Upload className="w-8 h-8 animate-pulse" />
                    </div>
                    <h3 className="font-extrabold text-base">Drag & Drop Image Here</h3>
                    <p className="text-xs opacity-70 mt-1 max-w-xs mx-auto">Supports JPG, PNG screenshots or emails. Max file size: 5MB.</p>
                    <span className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all">
                      Browse Files
                    </span>
                  </label>
                </div>

                {scanLoading && (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs opacity-70">Executing Gemini multimodal document parsing...</p>
                  </div>
                )}

                {scannedEvents.length > 0 && (
                  <div className={`p-6 rounded-2xl border ${profile.theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <h3 className="font-extrabold text-lg mb-1 flex items-center gap-1.5 text-indigo-400">
                      <Sparkles className="w-5 h-5" />
                      Extracted Targets to Review
                    </h3>
                    <p className="text-xs opacity-70 mb-4">Click "Add" to enlist them directly into your dockets.</p>

                    <div className="space-y-3.5">
                      {scannedEvents.map((ev, index) => (
                        <div 
                          key={index}
                          className="p-4 bg-slate-950/40 border border-white/5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[10px] font-extrabold uppercase">{ev.type}</span>
                              <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-[10px] font-extrabold uppercase">{ev.priority}</span>
                            </div>
                            <h4 className="font-extrabold text-sm text-white mt-1.5">{ev.name}</h4>
                            <p className="text-xs opacity-75 mt-1">Due Date: {ev.deadline} • Estimated time: {ev.estimatedHours}h</p>
                          </div>
                          <button
                            onClick={() => addScannedEventToTasks(ev, index)}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-lg shadow-md shrink-0 cursor-pointer"
                          >
                            Add to Tasks
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ==========================================
                5. AI CHAT ASSISTANT & VOICE TAB
               ========================================== */}
            {activeTab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 flex flex-col h-[580px]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight">AI Chat Assistant — Deadline Ninja</h2>
                    <p className="text-xs opacity-70 mt-0.5">Let Ninja assist scheduling fallback paths or query studying plans.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* TTS Enable toggles */}
                    <button
                      onClick={() => setTtsEnabled(!ttsEnabled)}
                      className={`p-2 rounded-lg border transition-all ${ttsEnabled ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400' : 'border-slate-800 text-slate-500'}`}
                      title={ttsEnabled ? "Voice output active" : "Voice output muted"}
                    >
                      {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Main chat log */}
                <div className={`flex-1 overflow-y-auto p-4 rounded-2xl border space-y-4 ${profile.theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                      <div className="text-4xl">🥋</div>
                      <h3 className="font-extrabold text-sm text-slate-400 mt-2">Dojo Channel Secured</h3>
                      <p className="text-[10px] opacity-75 max-w-xs mx-auto mt-1">Prompt tactical queries or study calendars. Ask "What should I do next?" to prioritize.</p>
                      
                      {/* Suggestion Chips */}
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-4 max-w-md mx-auto">
                        {[
                          "What should I do next?",
                          "Create a study plan for my exam",
                          "I couldn't finish my work today",
                          "Reschedule everything"
                        ].map((q, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setChatInput(q);
                              handleSendChat(q);
                            }}
                            className="px-3 py-1.5 bg-indigo-500/5 hover:bg-indigo-500/15 border border-indigo-500/10 hover:border-indigo-500/30 text-[10px] font-bold text-indigo-400 rounded-full transition-all cursor-pointer"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((msg, index) => (
                      <div 
                        key={index}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`p-3.5 rounded-2xl max-w-md text-xs relative ${
                          msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-br-none' 
                            : profile.theme === 'dark' 
                              ? 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none' 
                              : 'bg-slate-100 border border-slate-200/50 text-slate-800 rounded-bl-none'
                        }`}>
                          {/* Markdown parsing preview simple */}
                          <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                          <span className="text-[9px] opacity-55 block mt-2 text-right">{msg.time}</span>
                        </div>
                      </div>
                    ))
                  )}

                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs flex items-center gap-2 text-indigo-400">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Input block */}
                <div className="flex gap-2 relative">
                  {/* Voice assistant microphone chip */}
                  <button
                    onClick={toggleListening}
                    className={`px-4 rounded-xl flex items-center justify-center transition-all border ${
                      isListening 
                        ? 'bg-red-500/10 border-red-500 text-red-500 animate-pulse' 
                        : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                    }`}
                    title="🎤 Ask Deadline Ninja"
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  <input
                    type="text"
                    placeholder="Message Deadline Ninja or type command..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendChat();
                    }}
                    className={`flex-1 p-3.5 rounded-xl border text-xs outline-none focus:border-indigo-500 ${profile.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                  <button
                    onClick={() => handleSendChat()}
                    className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center justify-center shadow-lg cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ==========================================
                6. SHINOBI CONFIG / PROFILE TAB
               ========================================== */}
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Shinobi Configuration & Settings</h2>
                  <p className="text-xs opacity-70 mt-0.5">Maintain credentials, review rank summaries, and trigger scrolls.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Avatar selector & Rank overview */}
                  <div className={`p-6 rounded-2xl border text-center flex flex-col items-center justify-center ${profile.theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <img 
                      src={profile.photoURL || undefined} 
                      alt="Profile" 
                      className="w-24 h-24 rounded-full border-4 border-indigo-600 object-cover shadow-xl shadow-indigo-500/10 mb-4"
                    />
                    <h3 className="font-extrabold text-xl">{profile.name}</h3>
                    <p className="text-xs text-indigo-400 font-bold mt-1">@{profile.username}</p>

                    <div className="w-full mt-6 space-y-3 pt-4 border-t border-white/5">
                      <div className="flex justify-between text-xs">
                        <span className="opacity-70">Shinobi Level</span>
                        <span className="font-black">Level {profile.level}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="opacity-70">Experience Points (XP)</span>
                        <span className="font-black">{profile.xp} XP</span>
                      </div>
                    </div>

                    <button
                      onClick={triggerWeeklyReport}
                      disabled={reportLoading}
                      className="w-full mt-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1 shadow-lg shadow-indigo-500/20 cursor-pointer"
                    >
                      {reportLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "📜 Trigger Performance Scroll"}
                    </button>
                  </div>

                  {/* Profile Form controls */}
                  <div className={`lg:col-span-2 p-6 rounded-2xl border ${profile.theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <h3 className="font-extrabold text-lg mb-4">Credentials Management</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-75">Update Real Name</label>
                        <input
                          type="text"
                          value={profile.name}
                          onChange={async (e) => {
                            if (!currentUser) return;
                            const newN = e.target.value;
                            setProfile(p => ({ ...p, name: newN }));
                            await updateDoc(doc(db, 'users', currentUser.uid), { name: newN });
                          }}
                          className={`w-full p-3 rounded-xl border text-xs outline-none focus:border-indigo-500 ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-75">Update Avatar Image URL</label>
                        <input
                          type="text"
                          value={profile.photoURL}
                          onChange={async (e) => {
                            if (!currentUser) return;
                            const newP = e.target.value;
                            setProfile(p => ({ ...p, photoURL: newP }));
                            await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: newP });
                          }}
                          className={`w-full p-3 rounded-xl border text-xs outline-none focus:border-indigo-500 ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                        />
                      </div>

                      <div className="pt-4 border-t border-white/5 space-y-4">
                        <h4 className="font-bold text-sm text-yellow-500">🏆 Dojo Badges Unlocked</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {[
                            { name: "White Belt", desc: "Dojo initialized", unlocked: true },
                            { name: "Task Slayer", desc: "Complete 5 tasks", unlocked: completedTasks >= 1 },
                            { name: "Habit Sensei", desc: "Hit a 5-day habit", unlocked: habits.some(h => h.streak >= 1) },
                          ].map((b, idx) => (
                            <div 
                              key={idx}
                              className={`p-3 rounded-xl border text-center transition-all ${
                                b.unlocked 
                                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                                  : 'bg-slate-950/20 border-white/5 opacity-40'
                              }`}
                            >
                              <span className="text-xl">🏆</span>
                              <h4 className="font-bold text-xs mt-1.5">{b.name}</h4>
                              <p className="text-[9px] opacity-75 mt-0.5">{b.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* ==========================================
          MODAL: ADD / EDIT TASK
         ========================================== */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsTaskModalOpen(false)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl relative z-10 ${profile.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-extrabold text-lg">{editingTask ? 'Edit Active Docket' : 'Enlist New Target'}</h3>
                <button onClick={() => setIsTaskModalOpen(false)} className="p-1 hover:bg-white/10 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-75">Task Description / Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Data Structures Assignment"
                    value={taskFormName}
                    onChange={(e) => setTaskFormName(e.target.value)}
                    className={`w-full p-3 rounded-xl border text-xs outline-none focus:border-indigo-500 ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-75">Deadline Date</label>
                    <input
                      type="date"
                      required
                      value={taskFormDeadline}
                      onChange={(e) => setTaskFormDeadline(e.target.value)}
                      className={`w-full p-3 rounded-xl border text-xs outline-none focus:border-indigo-500 ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-75">Severity Priority</label>
                    <select
                      value={taskFormPriority}
                      onChange={(e) => setTaskFormPriority(e.target.value as any)}
                      className={`w-full p-3 rounded-xl border text-xs outline-none focus:border-indigo-500 ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-75">Estimated Hours</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={taskFormEstHours}
                      onChange={(e) => setTaskFormEstHours(Number(e.target.value))}
                      className={`w-full p-3 rounded-xl border text-xs outline-none focus:border-indigo-500 ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-75">Completed Hours</label>
                    <input
                      type="number"
                      min="0"
                      max={taskFormEstHours}
                      required
                      value={taskFormCompHours}
                      onChange={(e) => setTaskFormCompHours(Number(e.target.value))}
                      className={`w-full p-3 rounded-xl border text-xs outline-none focus:border-indigo-500 ${profile.theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  Save Active docket
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: TACTICAL RESCUE PLAN PREVIEW
         ========================================== */}
      <AnimatePresence>
        {rescueTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setRescueTask(null)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-lg p-6 rounded-2xl border shadow-2xl relative z-10 max-h-[85vh] flex flex-col ${profile.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[10px] uppercase font-black text-red-400">🛡️ AI Tactical Strike Plan</span>
                  <h3 className="font-extrabold text-lg mt-0.5">{rescueTask.name}</h3>
                </div>
                <button onClick={() => setRescueTask(null)} className="p-1 hover:bg-white/10 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {rescueLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs opacity-70 animate-pulse">Consulting Ninja Grandmaster...</p>
                  </div>
                ) : (
                  <div className="text-xs leading-relaxed whitespace-pre-wrap text-slate-200 bg-slate-950/50 p-4 rounded-xl border border-white/5 font-medium">
                    {rescuePlanText}
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 text-right">
                <button
                  onClick={async () => {
                    // Mark as resolved/complete
                    if (currentUser) {
                      await updateDoc(doc(db, 'users', currentUser.uid, 'tasks', rescueTask.id), {
                        completedHours: rescueTask.estimatedHours,
                        completed: true,
                        riskScore: 0,
                        completedAt: new Date().toISOString()
                      });
                      await addXP(150);
                      playSound('taskSuccess');
                      triggerNotification("🏆 Rescue Plan Accomplished!", `Splendid mastery! "${rescueTask.name}" completed successfully (+150 XP).`);
                    }
                    setRescueTask(null);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/10 cursor-pointer"
                >
                  Accept & Complete Task
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: WEEKLY NINJA PERFORMANCE SCROLL
         ========================================== */}
      <AnimatePresence>
        {weeklyReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setWeeklyReport(null)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg p-8 rounded-2xl bg-amber-50 border border-amber-200/60 text-slate-900 shadow-2xl relative z-10 max-h-[85vh] flex flex-col font-serif"
              style={{ backgroundImage: "radial-gradient(#fdf6e2 1px, transparent 0)" }}
            >
              <div className="flex items-center justify-between mb-4 border-b border-amber-900/10 pb-4">
                <div className="text-center w-full">
                  <span className="text-[10px] tracking-widest uppercase font-black text-amber-800">🥋 Elite Performance Scroll 🥋</span>
                  <h3 className="font-extrabold text-2xl text-amber-950 mt-1">Dojo Productivity Scroll</h3>
                </div>
                <button onClick={() => setWeeklyReport(null)} className="p-1 hover:bg-amber-100 rounded text-amber-900 absolute right-4 top-4">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                <div className="flex justify-around py-4 bg-amber-100/40 rounded-xl border border-amber-900/5">
                  <div className="text-center">
                    <span className="text-[10px] text-amber-800 uppercase font-bold tracking-wider">Weekly Rank</span>
                    <div className="text-4xl font-black text-amber-900 mt-1">{weeklyReport.grade}</div>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-amber-800 uppercase font-bold tracking-wider">Dojo Score</span>
                    <div className="text-4xl font-black text-amber-900 mt-1">{weeklyReport.score}/100</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-extrabold text-amber-950 text-sm flex items-center gap-1">🐉 Core Strengths</h4>
                  <ul className="list-disc list-inside text-xs text-amber-900 space-y-1 pl-1">
                    {weeklyReport.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-extrabold text-amber-950 text-sm flex items-center gap-1">🥋 Growth Defenses</h4>
                  <ul className="list-disc list-inside text-xs text-amber-900 space-y-1 pl-1">
                    {weeklyReport.growth.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </div>

                <div className="space-y-2 border-t border-amber-900/10 pt-4">
                  <h4 className="font-extrabold text-amber-950 text-sm flex items-center gap-1">🧘 Ninja Master Advice</h4>
                  <p className="text-xs text-amber-900 leading-relaxed italic">{weeklyReport.guidance}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-amber-900/10 text-center">
                <button
                  onClick={() => setWeeklyReport(null)}
                  className="px-6 py-2 bg-amber-900 hover:bg-amber-800 text-amber-50 font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer"
                >
                  Bow and Close Scroll
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
