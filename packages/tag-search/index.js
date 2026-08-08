const parser = require('./parser');
const metrics = require('./metrics');
const constants = require('./constants');
const repository = require('./repository');
const retrieval = require('./retrieval');
const priority = require('./priority');
const suggest = require('./suggest');

module.exports = {
  ...parser,
  ...metrics,
  constants,
  createTagListRepository: repository.createTagListRepository,
  createRetrievalIndex: retrieval.createRetrievalIndex,
  createPriorityIndex: priority.createPriorityIndex,
  applyPriorityTier: priority.applyPriorityTier,
  popularityFactor: priority.popularityFactor,
  createTagSuggester: suggest.createTagSuggester
};
