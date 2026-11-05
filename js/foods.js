// myDiet food library. ~330 everyday foods with realistic nutrition per serving, plus generated combinations
// (bowls, sandwiches, wraps, cooking styles…) whose nutrition is the sum of their parts. Capped at 2000 foods.
// Row format: name | serving | kcal | protein g | carbs g | fat g | sugar g | fiber g | sodium mg | category | kind
// kind: "plate" = sized with small / medium / large plate, "unit" = counted (1, 2, 3…), "drink" = cup sizes
const FOODS = (() => {
  const RAW = `
Chicken breast, grilled|6 oz|280|52|0|6|0|0|120|Protein|plate
Chicken thighs, roasted|6 oz|350|42|0|20|0|0|160|Protein|plate
Rotisserie chicken|6 oz|330|44|0|16|0|0|680|Protein|plate
Chicken tenders, breaded|4 pieces|420|28|26|22|1|1|900|Protein|unit
Chicken wings, buffalo|8 wings|620|46|4|46|1|0|1650|Protein|unit
Ground turkey 93% lean|5 oz|240|32|0|12|0|0|130|Protein|plate
Turkey breast, sliced deli|3 oz|90|18|2|1|1|0|600|Protein|plate
Ground beef 90% lean|5 oz|300|34|0|17|0|0|110|Protein|plate
Ground beef 80% lean|5 oz|400|30|0|30|0|0|110|Protein|plate
Sirloin steak|8 oz|420|62|0|18|0|0|130|Protein|plate
Ribeye steak|10 oz|780|62|0|58|0|0|150|Protein|plate
Flank steak|6 oz|320|46|0|14|0|0|110|Protein|plate
Filet mignon|6 oz|360|42|0|20|0|0|100|Protein|plate
Pork chop, boneless|6 oz|300|44|0|12|0|0|110|Protein|plate
Pork tenderloin|6 oz|240|42|0|7|0|0|100|Protein|plate
Bacon|3 slices|130|9|0|10|0|0|560|Protein|unit
Turkey bacon|3 slices|90|9|1|6|0|0|510|Protein|unit
Breakfast sausage links|3 links|240|10|1|22|1|0|490|Protein|unit
Italian sausage|1 link|290|14|3|24|1|0|820|Protein|unit
Ham, sliced|3 oz|110|16|3|4|2|0|1000|Protein|plate
Salmon fillet|6 oz|350|38|0|21|0|0|100|Protein|plate
Tilapia|6 oz|220|44|0|4|0|0|95|Protein|plate
Cod|6 oz|180|40|0|2|0|0|130|Protein|plate
Shrimp|6 oz|170|36|2|2|0|0|860|Protein|plate
Tuna, canned in water|1 can|120|26|0|1|0|0|300|Protein|unit
Tuna steak|6 oz|220|50|0|2|0|0|80|Protein|plate
Eggs|1 large|72|6|0|5|0|0|70|Protein|unit
Egg whites|1 cup|125|26|2|0|2|0|400|Protein|drink
Hard boiled eggs|2 eggs|155|13|1|11|1|0|125|Protein|unit
Scrambled eggs|3 eggs|300|20|3|22|2|0|420|Protein|plate
Tofu, firm|6 oz|240|26|6|14|1|3|20|Protein|plate
Tempeh|4 oz|220|22|10|12|0|6|10|Protein|plate
Beef jerky|1 oz|80|11|6|1|5|0|440|Protein|unit
Bison burger patty|1 patty|250|28|0|15|0|0|80|Protein|unit
Beef burger patty|1 patty|290|22|0|22|0|0|80|Protein|unit
Turkey burger patty|1 patty|200|22|0|12|0|0|120|Protein|unit
Veggie burger patty|1 patty|180|15|12|8|1|4|420|Protein|unit
Hot dog|1 frank|180|7|2|16|1|0|560|Protein|unit
Meatballs|4 meatballs|300|20|10|20|2|1|620|Protein|unit
Greek yogurt, plain nonfat|1 cup|130|23|9|0|7|0|80|Dairy|drink
Greek yogurt, vanilla|1 cup|180|18|22|2|20|0|75|Dairy|drink
Cottage cheese 2%|1 cup|180|24|9|5|9|0|700|Dairy|drink
Milk, whole|1 cup|150|8|12|8|12|0|105|Dairy|drink
Milk, 2%|1 cup|120|8|12|5|12|0|115|Dairy|drink
Milk, skim|1 cup|90|8|12|0|12|0|130|Dairy|drink
Chocolate milk|1 cup|200|8|26|8|24|1|150|Dairy|drink
Fairlife protein milk|1 cup|80|13|3|2|3|0|130|Dairy|drink
Almond milk, unsweetened|1 cup|30|1|1|3|0|1|170|Dairy|drink
Oat milk|1 cup|120|3|16|5|7|2|100|Dairy|drink
Cheddar cheese|1 oz|115|7|0|9|0|0|180|Dairy|unit
Mozzarella cheese|1 oz|85|6|1|6|0|0|175|Dairy|unit
String cheese|1 stick|80|7|1|6|0|0|200|Dairy|unit
American cheese|1 slice|70|4|1|5|1|0|270|Dairy|unit
Parmesan cheese|2 tbsp|45|4|0|3|0|0|160|Dairy|unit
Cream cheese|2 tbsp|100|2|1|10|1|0|90|Dairy|unit
Butter|1 tbsp|100|0|0|11|0|0|90|Dairy|unit
Sour cream|2 tbsp|60|1|1|6|1|0|15|Dairy|unit
Ice cream, vanilla|1 cup|270|5|32|14|28|1|105|Dessert|drink
White rice, cooked|1 cup|205|4|45|0|0|1|0|Grains|plate
Brown rice, cooked|1 cup|215|5|45|2|1|4|10|Grains|plate
Jasmine rice, cooked|1 cup|210|4|46|0|0|1|0|Grains|plate
Quinoa, cooked|1 cup|220|8|39|4|2|5|15|Grains|plate
Pasta, cooked|2 cups|440|16|86|3|2|5|0|Grains|plate
Whole wheat pasta, cooked|2 cups|350|15|74|2|2|12|10|Grains|plate
Oatmeal, cooked|1 cup|160|6|27|3|1|4|10|Breakfast|plate
Rolled oats, dry|1/2 cup|150|5|27|3|1|4|0|Breakfast|plate
Overnight oats|1 jar|380|20|52|10|18|7|120|Breakfast|plate
Granola|1/2 cup|300|7|38|14|14|4|10|Breakfast|plate
Cheerios|1 cup|100|3|20|2|1|3|140|Breakfast|plate
Frosted Flakes|1 cup|150|2|36|0|15|1|190|Breakfast|plate
Raisin Bran|1 cup|190|5|46|1|18|7|210|Breakfast|plate
Bagel, plain|1 bagel|280|11|55|2|6|2|450|Breakfast|unit
English muffin|1 muffin|130|5|26|1|2|2|240|Breakfast|unit
Pancakes|3 pancakes|350|9|54|11|12|2|720|Breakfast|unit
Waffles|2 waffles|380|9|52|15|10|2|720|Breakfast|unit
French toast|2 slices|360|12|44|15|14|2|560|Breakfast|unit
Breakfast burrito|1 burrito|560|28|48|28|3|3|1200|Breakfast|unit
Breakfast sandwich, egg & cheese|1 sandwich|380|18|32|20|4|1|820|Breakfast|unit
Hash browns|1 cup|320|3|30|21|0|3|420|Breakfast|plate
Avocado toast|1 slice|240|6|24|14|2|7|320|Breakfast|unit
Protein pancakes|3 pancakes|320|28|36|7|8|3|540|Breakfast|unit
White bread|1 slice|75|2|14|1|2|1|140|Grains|unit
Whole wheat bread|1 slice|80|4|14|1|2|2|150|Grains|unit
Sourdough bread|1 slice|120|4|23|1|1|1|240|Grains|unit
Flour tortilla|1 large|210|6|36|5|1|2|490|Grains|unit
Corn tortilla|1 tortilla|55|1|11|1|0|2|10|Grains|unit
Hamburger bun|1 bun|140|5|26|2|4|1|240|Grains|unit
Hoagie roll|1 roll|290|10|54|4|6|2|520|Grains|unit
Pita bread|1 pita|170|6|35|1|1|1|320|Grains|unit
Rice cakes|2 cakes|70|2|15|1|0|1|60|Snacks|unit
Sweet potato, baked|1 medium|115|2|27|0|6|4|40|Vegetables|unit
Baked potato|1 medium|160|4|37|0|2|4|15|Vegetables|unit
Mashed potatoes|1 cup|240|4|35|9|3|3|660|Vegetables|plate
French fries|medium|370|4|48|17|0|4|260|Fast food|plate
Sweet potato fries|medium|330|3|42|16|9|5|310|Fast food|plate
Broccoli|1 cup|55|4|11|1|2|5|65|Vegetables|plate
Green beans|1 cup|45|2|10|0|4|4|5|Vegetables|plate
Asparagus|1 cup|40|4|7|0|2|4|25|Vegetables|plate
Spinach, raw|2 cups|15|2|2|0|0|1|50|Vegetables|plate
Mixed greens salad|2 cups|20|2|4|0|1|2|40|Vegetables|plate
Caesar salad|1 bowl|360|9|14|30|2|3|720|Vegetables|plate
Carrots|1 cup|50|1|12|0|6|3|85|Vegetables|plate
Baby carrots|10 carrots|35|1|8|0|5|3|80|Vegetables|unit
Bell pepper|1 pepper|30|1|7|0|5|3|5|Vegetables|unit
Cucumber|1 cup|15|1|4|0|2|1|2|Vegetables|plate
Tomato|1 medium|22|1|5|0|3|1|6|Vegetables|unit
Corn|1 cup|130|5|29|2|9|4|5|Vegetables|plate
Peas|1 cup|120|8|21|1|8|7|5|Vegetables|plate
Zucchini|1 cup|20|2|4|0|3|1|10|Vegetables|plate
Cauliflower rice|1 cup|25|2|5|0|2|2|30|Vegetables|plate
Brussels sprouts, roasted|1 cup|110|4|12|6|3|4|300|Vegetables|plate
Black beans|1 cup|230|15|41|1|1|15|400|Vegetables|plate
Pinto beans|1 cup|245|15|45|1|1|15|400|Vegetables|plate
Chickpeas|1 cup|270|15|45|4|8|12|400|Vegetables|plate
Lentils, cooked|1 cup|230|18|40|1|4|16|5|Vegetables|plate
Edamame|1 cup|190|17|14|8|3|8|10|Vegetables|plate
Avocado|1 avocado|240|3|13|22|1|10|10|Fruit|unit
Banana|1 medium|105|1|27|0|14|3|1|Fruit|unit
Apple|1 medium|95|0|25|0|19|4|2|Fruit|unit
Orange|1 medium|62|1|15|0|12|3|0|Fruit|unit
Strawberries|1 cup|50|1|12|0|7|3|2|Fruit|plate
Blueberries|1 cup|85|1|21|0|15|4|1|Fruit|plate
Raspberries|1 cup|65|1|15|1|5|8|1|Fruit|plate
Grapes|1 cup|105|1|27|0|23|1|3|Fruit|plate
Watermelon|2 cups|90|2|23|0|18|1|3|Fruit|plate
Pineapple|1 cup|80|1|22|0|16|2|2|Fruit|plate
Mango|1 cup|100|1|25|1|23|3|2|Fruit|plate
Peach|1 medium|60|1|15|0|13|2|0|Fruit|unit
Pear|1 medium|100|1|27|0|17|6|2|Fruit|unit
Cherries|1 cup|95|2|25|0|20|3|0|Fruit|plate
Dates|3 dates|200|1|54|0|48|5|1|Fruit|unit
Raisins|1/4 cup|120|1|32|0|24|2|5|Fruit|unit
Peanut butter|2 tbsp|190|8|7|16|3|2|140|Snacks|unit
Almond butter|2 tbsp|195|7|6|18|2|3|5|Snacks|unit
Almonds|1 oz|165|6|6|14|1|4|0|Snacks|unit
Peanuts|1 oz|165|7|5|14|1|2|90|Snacks|unit
Cashews|1 oz|160|5|9|12|2|1|5|Snacks|unit
Walnuts|1 oz|185|4|4|18|1|2|0|Snacks|unit
Trail mix|1/4 cup|175|5|17|11|11|2|50|Snacks|unit
Sunflower seeds|1 oz|165|6|7|14|1|3|1|Snacks|unit
Chia seeds|1 tbsp|60|2|5|4|0|4|2|Snacks|unit
Hummus|1/4 cup|100|4|9|6|0|3|240|Snacks|unit
Potato chips|1 oz|160|2|15|10|0|1|170|Snacks|unit
Tortilla chips|1 oz|140|2|19|7|0|1|120|Snacks|unit
Salsa|1/4 cup|20|1|4|0|2|1|380|Sauces|unit
Guacamole|1/4 cup|100|1|6|9|1|4|220|Sauces|unit
Queso dip|1/4 cup|120|4|5|9|1|0|560|Sauces|unit
Pretzels|1 oz|110|3|23|1|1|1|450|Snacks|unit
Popcorn, buttered|3 cups|170|2|18|11|0|3|300|Snacks|unit
Goldfish crackers|1 oz|140|4|20|5|0|1|250|Snacks|unit
Cheez-Its|1 oz|150|3|17|8|0|1|230|Snacks|unit
Pop-Tarts|2 pastries|380|4|70|10|32|1|340|Snacks|unit
Granola bar|1 bar|190|3|29|7|12|2|110|Snacks|unit
Protein bar|1 bar|210|20|23|7|2|8|190|Supplements|unit
Quest bar|1 bar|200|21|22|8|1|14|230|Supplements|unit
RXBAR|1 bar|210|12|24|9|13|5|260|Supplements|unit
Clif bar|1 bar|250|10|44|5|17|4|200|Snacks|unit
Whey protein shake|1 scoop|120|24|3|1|1|0|50|Supplements|unit
Casein protein shake|1 scoop|120|24|4|1|1|1|200|Supplements|unit
Plant protein shake|1 scoop|130|22|5|3|1|2|300|Supplements|unit
Mass gainer shake|1 serving|650|32|110|8|20|2|300|Supplements|unit
Creatine|5 g|0|0|0|0|0|0|0|Supplements|unit
Pre-workout|1 scoop|10|0|2|0|0|0|100|Supplements|unit
BCAA drink|1 scoop|5|0|1|0|0|0|10|Supplements|unit
Fish oil|2 softgels|20|0|0|2|0|0|0|Supplements|unit
Multivitamin|1 tablet|5|0|1|0|0|0|0|Supplements|unit
Water|16 oz|0|0|0|0|0|0|0|Drinks|drink
Coffee, black|12 oz|5|0|0|0|0|0|10|Drinks|drink
Coffee with cream and sugar|12 oz|90|1|12|4|11|0|20|Drinks|drink
Latte|16 oz|190|12|18|7|17|0|170|Drinks|drink
Iced caramel macchiato|16 oz|250|10|35|7|33|0|150|Drinks|drink
Cold brew|16 oz|5|0|0|0|0|0|15|Drinks|drink
Frappuccino|16 oz|380|5|54|15|53|0|240|Drinks|drink
Green tea|16 oz|0|0|0|0|0|0|5|Drinks|drink
Sweet tea|16 oz|180|0|45|0|44|0|10|Drinks|drink
Orange juice|1 cup|110|2|26|0|21|0|2|Drinks|drink
Apple juice|1 cup|115|0|28|0|24|0|10|Drinks|drink
Coca-Cola|12 oz|140|0|39|0|39|0|45|Drinks|drink
Diet Coke|12 oz|0|0|0|0|0|0|40|Drinks|drink
Sprite|12 oz|140|0|38|0|38|0|65|Drinks|drink
Mountain Dew|12 oz|170|0|46|0|46|0|60|Drinks|drink
Gatorade|20 oz|140|0|36|0|34|0|270|Drinks|drink
Gatorade Zero|20 oz|10|0|2|0|0|0|230|Drinks|drink
Celsius|12 oz|10|0|2|0|0|0|0|Drinks|drink
Red Bull|8.4 oz|110|0|28|0|27|0|105|Drinks|drink
Monster Energy|16 oz|210|0|54|0|54|0|370|Drinks|drink
Bang energy drink|16 oz|0|0|0|0|0|0|40|Drinks|drink
Body Armor|16 oz|120|0|30|0|28|0|30|Drinks|drink
Coconut water|11 oz|60|0|15|0|13|0|60|Drinks|drink
Beer|12 oz|150|2|13|0|0|0|15|Drinks|drink
Light beer|12 oz|100|1|6|0|0|0|10|Drinks|drink
Hard seltzer|12 oz|100|0|2|0|2|0|20|Drinks|drink
Wine|5 oz|125|0|4|0|1|0|5|Drinks|drink
Big Mac|1 burger|590|25|46|34|9|3|1050|Fast food|unit
Quarter Pounder with Cheese|1 burger|520|30|42|26|10|2|1140|Fast food|unit
McChicken|1 sandwich|400|14|39|21|5|1|560|Fast food|unit
Chicken McNuggets|10 pieces|410|23|26|24|0|2|840|Fast food|unit
Egg McMuffin|1 sandwich|310|17|30|13|3|2|770|Fast food|unit
McDonald's fries|medium|320|5|43|15|0|4|260|Fast food|plate
Chick-fil-A sandwich|1 sandwich|440|28|41|17|6|1|1400|Fast food|unit
Chick-fil-A nuggets|8 count|250|27|11|11|1|0|1210|Fast food|unit
Chick-fil-A grilled nuggets|12 count|200|38|2|5|1|0|720|Fast food|unit
Chick-fil-A waffle fries|medium|420|5|45|24|1|5|240|Fast food|plate
Chipotle burrito bowl|1 bowl|720|50|72|24|5|14|1900|Fast food|plate
Chipotle burrito|1 burrito|1020|55|112|38|6|15|2500|Fast food|unit
Chipotle chips & guac|1 order|770|10|64|54|1|14|570|Fast food|unit
Subway 6" turkey sub|1 sub|280|18|46|3|5|5|760|Fast food|unit
Subway footlong chicken teriyaki|1 sub|660|50|102|9|30|8|1660|Fast food|unit
Taco Bell crunchy taco|1 taco|170|8|13|9|1|3|300|Fast food|unit
Taco Bell burrito supreme|1 burrito|390|16|50|14|4|7|1080|Fast food|unit
Taco Bell Crunchwrap Supreme|1 wrap|530|16|71|21|6|6|1200|Fast food|unit
Taco Bell chicken quesadilla|1 quesadilla|510|26|37|27|3|2|1250|Fast food|unit
Wendy's Dave's Single|1 burger|590|29|39|34|9|2|1260|Fast food|unit
Wendy's Frosty|small|340|9|56|9|47|0|190|Dessert|drink
Burger King Whopper|1 burger|670|31|54|40|12|2|1010|Fast food|unit
Five Guys cheeseburger|1 burger|980|47|40|55|8|2|1050|Fast food|unit
In-N-Out Double-Double|1 burger|670|37|39|41|10|3|1440|Fast food|unit
Panda Express orange chicken|1 serving|490|25|51|23|19|2|820|Fast food|plate
Panda Express fried rice|1 serving|520|11|85|16|3|1|850|Fast food|plate
Panda Express chow mein|1 serving|510|13|80|20|9|6|860|Fast food|plate
Panda Express Beijing beef|1 serving|470|14|46|26|24|1|660|Fast food|plate
Raising Cane's box combo|1 combo|1250|51|116|65|4|7|2160|Fast food|unit
Wingstop boneless wings|8 pieces|680|36|40|42|2|2|2100|Fast food|unit
Domino's pepperoni pizza|2 slices|580|24|62|26|6|4|1260|Fast food|unit
Cheese pizza|2 slices|570|24|70|20|8|4|1280|Fast food|unit
Pepperoni pizza|2 slices|620|26|68|26|8|4|1440|Fast food|unit
Sushi California roll|8 pieces|260|8|38|7|6|2|560|Restaurant|unit
Sushi spicy tuna roll|8 pieces|290|12|36|11|4|2|580|Restaurant|unit
Salmon nigiri|2 pieces|120|8|16|3|3|0|200|Restaurant|unit
Poke bowl|1 bowl|650|38|72|22|10|6|1500|Restaurant|plate
Pad thai|1 plate|780|28|96|30|26|4|1800|Restaurant|plate
Chicken tikka masala|1 plate|650|38|30|40|10|4|1400|Restaurant|plate
General Tso's chicken|1 plate|1050|45|100|52|52|3|2000|Restaurant|plate
Beef and broccoli|1 plate|560|38|32|30|12|5|1600|Restaurant|plate
Chicken fried rice|1 plate|620|26|80|20|3|3|1300|Restaurant|plate
Spaghetti and meatballs|1 plate|780|36|90|28|14|8|1400|Restaurant|plate
Chicken alfredo|1 plate|1200|60|90|65|6|4|1900|Restaurant|plate
Mac and cheese|1 cup|380|15|40|18|6|2|840|Restaurant|plate
Lasagna|1 piece|430|25|35|20|8|3|900|Restaurant|plate
Grilled cheese sandwich|1 sandwich|440|17|34|26|4|2|1000|Restaurant|unit
BLT sandwich|1 sandwich|500|18|34|32|5|2|1200|Restaurant|unit
Club sandwich|1 sandwich|590|35|43|29|6|3|1650|Restaurant|unit
Philly cheesesteak|1 sandwich|820|46|62|42|8|3|1800|Restaurant|unit
Chicken Caesar wrap|1 wrap|620|38|46|30|3|3|1400|Restaurant|unit
Buffalo chicken wrap|1 wrap|640|36|50|32|3|3|1700|Restaurant|unit
Fish tacos|2 tacos|460|24|44|20|4|5|820|Restaurant|unit
Steak tacos|3 tacos|540|36|42|24|3|5|900|Restaurant|unit
Chicken quesadilla|1 quesadilla|680|42|46|36|3|3|1500|Restaurant|unit
Nachos supreme|1 plate|950|35|80|56|5|12|1900|Restaurant|plate
Cheeseburger|1 burger|550|30|40|30|8|2|1000|Restaurant|unit
Chicken sandwich, grilled|1 sandwich|440|36|40|14|7|2|1000|Restaurant|unit
Chicken pot pie|1 pie|720|24|62|42|7|3|1300|Restaurant|unit
Beef chili|1 bowl|370|26|30|16|8|9|1100|Restaurant|plate
Chicken noodle soup|1 bowl|180|12|20|5|2|2|1300|Restaurant|plate
Tomato soup|1 bowl|170|4|26|6|16|3|900|Restaurant|plate
Clam chowder|1 bowl|330|10|24|21|3|1|1000|Restaurant|plate
Ramen, instant|1 package|380|8|52|14|2|2|1600|Restaurant|plate
Tonkotsu ramen|1 bowl|850|38|80|40|6|4|2800|Restaurant|plate
Frozen pizza|1/2 pizza|680|28|76|28|8|4|1400|Frozen|plate
Hot Pockets|1 sandwich|310|11|38|12|7|2|660|Frozen|unit
Frozen burrito|1 burrito|330|12|47|10|2|5|680|Frozen|unit
Frozen chicken stir fry|1 bag|540|30|70|14|20|4|1700|Frozen|plate
Lean Cuisine meal|1 meal|300|18|40|8|8|4|650|Frozen|unit
Uncrustables PB&J|1 sandwich|210|6|26|10|9|2|220|Snacks|unit
PB&J sandwich|1 sandwich|380|13|48|16|18|4|460|Snacks|unit
Chocolate chip cookie|1 large|220|2|30|11|18|1|150|Dessert|unit
Brownie|1 piece|230|3|36|10|24|1|130|Dessert|unit
Donut, glazed|1 donut|260|4|31|14|15|1|210|Dessert|unit
Muffin, blueberry|1 muffin|430|6|60|19|33|2|380|Dessert|unit
Cheesecake|1 slice|400|7|32|28|26|0|340|Dessert|unit
Apple pie|1 slice|410|4|58|19|28|2|330|Dessert|unit
Milkshake, chocolate|16 oz|560|13|84|19|76|2|360|Dessert|drink
Dark chocolate|1 oz|170|2|13|12|7|3|5|Dessert|unit
Milk chocolate bar|1 bar|230|3|26|13|24|1|35|Dessert|unit
Gummy bears|1 bag|130|2|30|0|21|0|15|Dessert|unit
Frozen yogurt|1 cup|220|6|38|5|34|0|120|Dessert|drink
Ranch dressing|2 tbsp|130|0|2|13|1|0|260|Sauces|unit
Italian dressing|2 tbsp|70|0|3|6|2|0|300|Sauces|unit
Balsamic vinaigrette|2 tbsp|90|0|5|8|4|0|240|Sauces|unit
BBQ sauce|2 tbsp|60|0|15|0|12|0|350|Sauces|unit
Teriyaki sauce|2 tbsp|30|2|6|0|5|0|1200|Sauces|unit
Hot sauce|1 tsp|0|0|0|0|0|0|190|Sauces|unit
Ketchup|1 tbsp|20|0|5|0|4|0|160|Sauces|unit
Mayonnaise|1 tbsp|95|0|0|10|0|0|90|Sauces|unit
Mustard|1 tsp|3|0|0|0|0|0|55|Sauces|unit
Honey|1 tbsp|65|0|17|0|17|0|1|Sauces|unit
Maple syrup|2 tbsp|105|0|27|0|24|0|5|Sauces|unit
Olive oil|1 tbsp|120|0|0|14|0|0|0|Sauces|unit
Soy sauce|1 tbsp|10|1|1|0|0|0|880|Sauces|unit
Pesto|2 tbsp|160|2|2|16|0|0|240|Sauces|unit
Marinara sauce|1/2 cup|70|2|10|2|6|2|480|Sauces|unit
Alfredo sauce|1/4 cup|110|2|3|10|1|0|400|Sauces|unit`;

  const num = v => +v;
  const base = RAW.trim().split('\n').map((line, i) => {
    const [name, serving, kcal, protein, carbs, fat, sugar, fiber, sodium, cat, kind] = line.split('|');
    return { id: 'f' + i, name, serving, kcal: num(kcal), protein: num(protein), carbs: num(carbs), fat: num(fat), sugar: num(sugar), fiber: num(fiber), sodium: num(sodium), cat, kind };
  });
  const by = n => base.find(f => f.name === n);
  const KEYS = ['kcal', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'sodium'];
  const combine = (name, parts, cat, kind = 'plate', serving = '1 serving') => {
    const f = { name, serving, cat, kind, combo: true };
    KEYS.forEach(k => (f[k] = Math.round(parts.reduce((a, [p, q]) => a + (p ? p[k] * q : 0), 0))));
    return f;
  };
  const out = [...base];
  const add = f => { if (out.length < 2000 && !out.some(x => x.name === f.name)) out.push({ id: 'g' + out.length, ...f }); };

  // Cooking styles for the main proteins
  const STYLES = [['grilled', 1, 0, 0], ['baked', 1, 0, 0], ['air-fried', 1, 4, 3], ['pan-fried', 1, 0, 9], ['fried', 1, 18, 16], ['blackened', 1, 1, 3], ['BBQ', 1, 15, 2], ['teriyaki', 1, 12, 1], ['lemon pepper', 1, 1, 4], ['buffalo', 1, 2, 9]];
  const MAINS = ['Chicken breast, grilled', 'Salmon fillet', 'Tilapia', 'Shrimp', 'Sirloin steak', 'Pork chop, boneless', 'Tofu, firm', 'Ground turkey 93% lean', 'Cod', 'Chicken thighs, roasted', 'Pork tenderloin', 'Tuna steak'];
  MAINS.forEach(m => {
    const p = by(m), plain = m.split(',')[0];
    STYLES.forEach(([st, , carbs, fat]) => add({ name: `${plain}, ${st}`, serving: p.serving, cat: 'Protein', kind: 'plate',
      kcal: p.kcal + carbs * 4 + fat * 9, protein: p.protein, carbs: p.carbs + carbs, fat: p.fat + fat, sugar: p.sugar + (st === 'BBQ' || st === 'teriyaki' ? carbs * .8 : 0) | 0,
      fiber: p.fiber, sodium: p.sodium + (st === 'fried' ? 450 : st === 'teriyaki' ? 700 : st === 'BBQ' ? 380 : st === 'buffalo' ? 600 : 150) }));
  });

  // Bowls: base × protein × sauce
  const BASES = [['rice bowl', 'White rice, cooked'], ['brown rice bowl', 'Brown rice, cooked'], ['quinoa bowl', 'Quinoa, cooked'], ['salad', 'Mixed greens salad'], ['burrito bowl', 'Brown rice, cooked']];
  const PROTEINS = [['Chicken', 'Chicken breast, grilled'], ['Steak', 'Sirloin steak'], ['Salmon', 'Salmon fillet'], ['Shrimp', 'Shrimp'], ['Tofu', 'Tofu, firm'], ['Ground turkey', 'Ground turkey 93% lean'], ['Pork', 'Pork tenderloin'], ['Tuna', 'Tuna steak']];
  const SAUCES = [['teriyaki', 'Teriyaki sauce'], ['BBQ', 'BBQ sauce'], ['pesto', 'Pesto'], ['ranch', 'Ranch dressing'], ['', null], ['spicy mayo', 'Mayonnaise'], ['balsamic', 'Balsamic vinaigrette']];
  BASES.forEach(([bn, b]) => PROTEINS.forEach(([pn, p]) => SAUCES.forEach(([sn, sc]) => {
    const extra = bn === 'burrito bowl' ? [[by('Black beans'), .5], [by('Salsa'), 1], [by('Cheddar cheese'), 1]] : bn === 'salad' ? [[by('Cucumber'), .5], [by('Tomato'), 1]] : [[by('Broccoli'), .5]];
    add(combine(`${pn} ${sn ? sn + ' ' : ''}${bn}`, [[by(b), bn === 'salad' ? 1 : 1.5], [by(p), .75], [sc && by(sc), 1], ...extra], 'Bowls'));
  })));

  // Sandwiches & wraps: bread × protein × cheese
  const BREADS = [['sandwich', 'Whole wheat bread', 2], ['sub', 'Hoagie roll', 1], ['wrap', 'Flour tortilla', 1], ['pita', 'Pita bread', 1], ['sourdough sandwich', 'Sourdough bread', 2]];
  const FILL = [['Turkey', 'Turkey breast, sliced deli', 1.3], ['Chicken', 'Chicken breast, grilled', .5], ['Ham', 'Ham, sliced', 1.3], ['Tuna', 'Tuna, canned in water', .6], ['Steak', 'Sirloin steak', .4], ['Salmon', 'Salmon fillet', .5]];
  const CHEESE = [['', null], [' and cheddar', 'Cheddar cheese'], [' and mozzarella', 'Mozzarella cheese'], [' and American cheese', 'American cheese']];
  BREADS.forEach(([bn, b, q]) => FILL.forEach(([fn, f, fq]) => CHEESE.forEach(([cn, c]) => add(combine(`${fn}${cn} ${bn}`, [[by(b), q], [by(f), fq], [c && by(c), 1], [by('Mayonnaise'), .5], [by('Tomato'), .5]], 'Sandwiches', 'unit', '1 ' + bn.split(' ').pop())))));

  // Eggs & breakfast plates
  [['scramble', 3], ['omelette', 3], ['egg plate', 2]].forEach(([n, eggs]) => [['', null], [' with bacon', 'Bacon'], [' with sausage', 'Breakfast sausage links'], [' with ham', 'Ham, sliced'], [' with spinach', 'Spinach, raw'], [' with cheese', 'Cheddar cheese'], [' with turkey bacon', 'Turkey bacon']].forEach(([wn, w]) =>
    [['', null], [' and toast', 'Whole wheat bread'], [' and hash browns', 'Hash browns']].forEach(([sn, side]) => add(combine(`Egg ${n}${wn}${sn}`, [[by('Eggs'), eggs], [w && by(w), 1], [side && by(side), side === 'Whole wheat bread' ? 2 : 1]], 'Breakfast')))));

  // Oatmeal & yogurt bowls with toppings
  const TOPS = [['banana', 'Banana', 1], ['blueberries', 'Blueberries', .5], ['strawberries', 'Strawberries', .5], ['peanut butter', 'Peanut butter', 1], ['honey', 'Honey', 1], ['granola', 'Granola', .5], ['almonds', 'Almonds', 1], ['protein', 'Whey protein shake', 1]];
  [['Oatmeal', 'Oatmeal, cooked', 1.5], ['Greek yogurt bowl', 'Greek yogurt, plain nonfat', 1], ['Overnight oats', 'Overnight oats', 1]].forEach(([bn, b, q]) =>
    TOPS.forEach(([t1, f1, q1], i) => TOPS.slice(i + 1).forEach(([t2, f2, q2]) => add(combine(`${bn} with ${t1} and ${t2}`, [[by(b), q], [by(f1), q1], [by(f2), q2]], 'Breakfast')))));

  // Pasta dishes
  [['Spaghetti', 'Pasta, cooked'], ['Whole wheat pasta', 'Whole wheat pasta, cooked'], ['Penne', 'Pasta, cooked']].forEach(([pn, p]) => [['marinara', 'Marinara sauce'], ['alfredo', 'Alfredo sauce'], ['pesto', 'Pesto']].forEach(([sn, sc]) =>
    [['', null], [' with chicken', 'Chicken breast, grilled'], [' with shrimp', 'Shrimp'], [' with meatballs', 'Meatballs'], [' with sausage', 'Italian sausage'], [' with ground beef', 'Ground beef 90% lean']].forEach(([wn, w]) =>
      add(combine(`${pn} ${sn}${wn}`, [[by(p), 1], [by(sc), sn === 'marinara' ? 1 : 2], [w && by(w), w === 'Italian sausage' || w === 'Meatballs' ? 1 : .6]], 'Pasta')))));

  // Tacos / burritos / quesadillas
  [['Chicken', 'Chicken breast, grilled'], ['Steak', 'Sirloin steak'], ['Ground beef', 'Ground beef 90% lean'], ['Shrimp', 'Shrimp'], ['Fish', 'Tilapia'], ['Pork', 'Pork tenderloin'], ['Bean', 'Black beans']].forEach(([pn, p]) => {
    add(combine(`${pn} tacos (3)`, [[by('Corn tortilla'), 3], [by(p), .6], [by('Salsa'), 1], [by('Cheddar cheese'), .5]], 'Mexican', 'unit', '3 tacos'));
    add(combine(`${pn} burrito`, [[by('Flour tortilla'), 1], [by(p), .6], [by('White rice, cooked'), .75], [by('Black beans'), .5], [by('Cheddar cheese'), 1], [by('Salsa'), 1]], 'Mexican', 'unit', '1 burrito'));
    add(combine(`${pn} quesadilla`, [[by('Flour tortilla'), 1], [by(p), .5], [by('Cheddar cheese'), 2], [by('Sour cream'), 1]], 'Mexican', 'unit', '1 quesadilla'));
    add(combine(`${pn} nachos`, [[by('Tortilla chips'), 3], [by(p), .5], [by('Queso dip'), 1], [by('Salsa'), 1], [by('Guacamole'), 1]], 'Mexican'));
  });

  // Burgers
  [['Beef', 'Beef burger patty'], ['Turkey', 'Turkey burger patty'], ['Bison', 'Bison burger patty'], ['Veggie', 'Veggie burger patty']].forEach(([pn, p]) =>
    [['burger', []], ['cheeseburger', [['American cheese', 1]]], ['bacon cheeseburger', [['American cheese', 1], ['Bacon', 1]]], ['double cheeseburger', [['American cheese', 2]]]].forEach(([bn, ex]) =>
      [['', null], [' with fries', 'French fries'], [' with sweet potato fries', 'Sweet potato fries']].forEach(([sn, side]) =>
        add(combine(`${pn} ${bn}${sn}`, [[by('Hamburger bun'), 1], [by(p), bn.startsWith('double') ? 2 : 1], ...ex.map(([n, q]) => [by(n), q]), [by('Ketchup'), 1], [side && by(side), 1]], 'Burgers', 'unit', '1 burger')))));

  // Protein shakes
  [['Whey', 'Whey protein shake'], ['Casein', 'Casein protein shake'], ['Plant', 'Plant protein shake']].forEach(([pn, p]) => [['water', 'Water', 1], ['whole milk', 'Milk, whole', 1.5], ['2% milk', 'Milk, 2%', 1.5], ['almond milk', 'Almond milk, unsweetened', 1.5], ['oat milk', 'Oat milk', 1.5], ['Fairlife milk', 'Fairlife protein milk', 1.5]].forEach(([ln, l, lq]) =>
    [['', 1], [' (2 scoops)', 2]].forEach(([sn, sq]) => add(combine(`${pn} protein shake with ${ln}${sn}`, [[by(p), sq], [by(l), lq]], 'Shakes', 'drink', '1 shake')))));

  // Stir fries & rice plates
  [['Chicken', 'Chicken breast, grilled'], ['Beef', 'Flank steak'], ['Shrimp', 'Shrimp'], ['Tofu', 'Tofu, firm'], ['Pork', 'Pork tenderloin']].forEach(([pn, p]) =>
    [['teriyaki', 'Teriyaki sauce'], ['garlic', 'Soy sauce'], ['sweet and sour', 'BBQ sauce'], ['spicy', 'Hot sauce']].forEach(([sn, sc]) =>
      [['stir fry with rice', 'White rice, cooked'], ['stir fry with brown rice', 'Brown rice, cooked'], ['stir fry with noodles', 'Pasta, cooked'], ['stir fry with cauliflower rice', 'Cauliflower rice']].forEach(([fn, b]) =>
        add(combine(`${pn} ${sn} ${fn}`, [[by(p), .75], [by(sc), 1], [by(b), b === 'Pasta, cooked' ? .6 : 1.25], [by('Broccoli'), .75], [by('Bell pepper'), .5], [by('Olive oil'), .5]], 'Asian')))));

  // Plates: protein + side + veg (classic meal prep)
  const SIDES = [['rice', 'White rice, cooked', 1], ['brown rice', 'Brown rice, cooked', 1], ['sweet potato', 'Sweet potato, baked', 1], ['baked potato', 'Baked potato', 1], ['quinoa', 'Quinoa, cooked', 1], ['mashed potatoes', 'Mashed potatoes', 1]];
  const VEG = [['broccoli', 'Broccoli'], ['green beans', 'Green beans'], ['asparagus', 'Asparagus'], ['salad', 'Mixed greens salad']];
  [['Chicken', 'Chicken breast, grilled'], ['Steak', 'Sirloin steak'], ['Salmon', 'Salmon fillet'], ['Pork chop', 'Pork chop, boneless'], ['Turkey', 'Ground turkey 93% lean'], ['Cod', 'Cod'], ['Shrimp', 'Shrimp']].forEach(([pn, p]) =>
    SIDES.forEach(([sn, s, sq]) => VEG.forEach(([vn, v]) => add(combine(`${pn} with ${sn} and ${vn}`, [[by(p), 1], [by(s), sq], [by(v), 1]], 'Meal prep')))));

  return out;
})();

// Smoothie builder ingredients (per "medium" portion in a 16 oz smoothie)
const SMOOTHIE_PARTS = [
  ['Banana', 'Banana', 1], ['Strawberries', 'Strawberries', .75], ['Blueberries', 'Blueberries', .75], ['Mango', 'Mango', .75], ['Pineapple', 'Pineapple', .75], ['Raspberries', 'Raspberries', .75],
  ['Peanut butter', 'Peanut butter', 1], ['Almond butter', 'Almond butter', 1], ['Whey protein', 'Whey protein shake', 1], ['Plant protein', 'Plant protein shake', 1], ['Creatine', 'Creatine', 1],
  ['Honey', 'Honey', 1], ['Greek yogurt', 'Greek yogurt, plain nonfat', .5], ['Whole milk', 'Milk, whole', 1], ['2% milk', 'Milk, 2%', 1], ['Almond milk', 'Almond milk, unsweetened', 1], ['Oat milk', 'Oat milk', 1],
  ['Oats', 'Rolled oats, dry', .5], ['Spinach', 'Spinach, raw', .5], ['Chia seeds', 'Chia seeds', 1], ['Avocado', 'Avocado', .33], ['Orange juice', 'Orange juice', .75], ['Dates', 'Dates', .66], ['Ice', 'Water', 0]
].map(([label, food, q]) => ({ label, food: FOODS.find(f => f.name === food), q }));
