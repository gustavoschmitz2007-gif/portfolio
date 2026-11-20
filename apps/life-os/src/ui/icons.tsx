import {
  Apple, Atom, Award, Banana, Bath, Bed, BedDouble, Bell, BellRing, Bike, BookCheck, BookOpen, Brain, Briefcase, Brush, Calculator, Camera, Car,
  Carrot, ClipboardCheck, Code, Coffee, Crown, Dumbbell, Feather, Flame, FlaskConical, Footprints, Gamepad2, GlassWater, Goal, GraduationCap,
  Guitar, Headphones, Heart, HeartPulse, House, Languages, Laptop, Leaf, Library, Lightbulb, ListChecks, Medal, Microscope, Moon, Mountain,
  Music, NotebookPen, Paintbrush, PenLine, PersonStanding, PiggyBank, Pill, Plane, Rocket, Salad, Scale, ShoppingCart, Sigma, Smile, Sparkles,
  Sprout, Star, Sun, Sunrise, Tag, Target, Timer, Trophy, Users, Utensils, Volleyball, Wallet, Waves, Weight, Zap, Droplets, Phone, Shirt,
  FileText, Presentation, ClipboardList, BookMarked, CircleCheck,
  type LucideIcon, type LucideProps,
} from 'lucide-react';

/** Icons a user can pick for habits, areas, etc. Stored by name. */
export const PICKABLE_ICONS: Record<string, LucideIcon> = {
  Dumbbell, HeartPulse, Footprints, Bike, Waves, Volleyball, Trophy, PersonStanding, Weight, Mountain, Flame, Zap,
  Salad, Apple, Banana, Carrot, Utensils, GlassWater, Droplets, Coffee, Pill, Scale, Moon, BedDouble, Bed, Sunrise, Sun, Bath,
  GraduationCap, BookOpen, BookCheck, Library, NotebookPen, PenLine, Brain, Lightbulb, Calculator, Sigma, FlaskConical, Microscope, Atom, Languages, Laptop, Code,
  House, Brush, Sparkles, ClipboardCheck, ListChecks, ShoppingCart, Wallet, PiggyBank, Briefcase, Users, Phone, Shirt,
  Music, Guitar, Headphones, Gamepad2, Camera, Paintbrush, Feather, Plane, Car, Leaf, Sprout, Heart, Smile, Star, Medal, Award, Crown, Rocket, Goal, Target, Timer, Bell, BellRing, Tag,
};

export const ICON_NAMES = Object.keys(PICKABLE_ICONS);

/** Icons used by the app itself (resolvable by name, not offered in the picker). */
const SYSTEM_ICONS: Record<string, LucideIcon> = { FileText, Presentation, ClipboardList, BookMarked, CircleCheck };

export function DynIcon({ name, ...props }: { name: string } & LucideProps) {
  const C = PICKABLE_ICONS[name] ?? SYSTEM_ICONS[name] ?? Target;
  return <C {...props} />;
}
