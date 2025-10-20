module.exports = () => ({
  collection: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: [], size: 0 }),
  })),
  doc: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
    update: jest.fn().mockResolvedValue(undefined),
  })),
});