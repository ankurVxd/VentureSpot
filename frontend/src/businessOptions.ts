export const businessCategories = [
  { value: "cafe", label: "Café" },
  { value: "restaurant", label: "Restaurant" },
  { value: "bakery", label: "Bakery" },
  { value: "grocery", label: "Grocery / supermarket" },
  { value: "salon", label: "Salon / beauty" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "gym", label: "Gym / fitness centre" },
  { value: "clothing", label: "Clothing store" },
  { value: "general", label: "General businesses" },
  { value: "office_coworking", label: "Office & coworking" },
  { value: "laundry_cleaning", label: "Laundry & cleaning" },
  { value: "automotive", label: "Automotive services" },
  { value: "education", label: "Education & training" },
];

export const subcategoriesByCategory: Record<string, string[]> = {
  cafe: ["Specialty Coffee Shop", "Tea Shop", "Juice Bar", "Bubble Tea Shop", "Dessert Café", "Internet Café"],
  restaurant: ["Fast Food", "Fine Dining", "Family Restaurant", "Casual Dining", "South Indian", "North Indian", "Chinese", "Pizza", "Biryani", "Street Food", "Cloud Kitchen"],
  bakery: ["Cake Shop", "Pastry Shop", "Bread Bakery", "Custom Cake Studio", "Cookies & Confectionery", "Donut Shop"],
  grocery: ["Supermarket", "Mini-Mart", "Convenience Store", "Organic Grocery", "Fruit & Vegetable Shop", "Dairy Shop", "Wholesale Grocery"],
  salon: ["Hair Salon", "Barbershop", "Beauty Parlour", "Nail Salon", "Spa", "Bridal Makeup Studio", "Unisex Salon"],
  pharmacy: ["Retail Medical Store", "Generic Medicine Store", "Ayurvedic Store", "Surgical Supplies", "Medical Equipment Store"],
  gym: ["Traditional Gym", "Personal Training Studio", "Yoga Studio", "Pilates Studio", "CrossFit Studio", "Martial Arts Academy", "Dance Fitness Studio"],
  clothing: ["Men's Wear", "Women's Wear", "Kids' Wear", "Ethnic Wear", "Sportswear", "Footwear", "Boutique", "Accessories & Bags"],
  general: ["Electronics Store", "Mobile Phone Shop", "Computer Store", "Stationery Shop", "Gift Shop", "Home Décor", "Furniture Store", "Hardware Store", "Toy Shop", "Pet Supplies", "Bookstore"],
  office_coworking: ["Coworking Space", "Shared Office", "Private Office Rental", "Business Centre"],
  laundry_cleaning: ["Laundry", "Dry Cleaning", "Ironing Service", "Home Cleaning"],
  automotive: ["Car Repair", "Two-Wheeler Repair", "Car Wash", "Tyre Shop", "Auto Parts"],
  education: ["Coaching Classes", "Computer Training", "Language Institute", "Music School", "Skill Development Centre"],
};

export const foodPreferencesByCategory: Record<string, string[]> = {
  cafe: ["Pure Veg", "Non-Veg", "Veg & Non-Veg", "Vegan-Friendly", "Jain-Friendly"],
  restaurant: ["Pure Veg", "Non-Veg", "Veg & Non-Veg", "Vegan-Friendly", "Jain-Friendly"],
};

export function capacityTypeForCategory(category: string): "cafe_restaurant" | "salon" | "gym" | "retail" | "grocery" | "office" | "other" {
  if (category === "cafe" || category === "restaurant" || category === "bakery") return "cafe_restaurant";
  if (category === "salon") return "salon";
  if (category === "gym") return "gym";
  if (category === "grocery") return "grocery";
  if (category === "office_coworking") return "office";
  if (category === "clothing" || category === "general" || category === "pharmacy") return "retail";
  return "other";
}
