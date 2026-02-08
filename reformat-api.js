const fs = require('fs');

const data = JSON.parse(fs.readFileSync('api.json', 'utf8'));

const reordered = data.map(item => {
  const { id, name, series, element, role, is_iconic, image_url } = item;
  const obj = { name, series, element, role, image_url, id };
  if (is_iconic !== undefined) {
    obj.is_iconic = is_iconic;
    const { id: _, ...rest } = obj;
    return { ...rest, id };
  }
  return obj;
});

fs.writeFileSync('api.json', JSON.stringify(reordered, null, 2));
console.log('✓ api.json reformatted');
