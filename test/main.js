const chai = require('chai');
global.expect = chai.expect;

require('./sorted_set_test');
require('./uniform_map_test');
//
require('./cluster_node_test');
//
require('./elio_integration_test');
require('./elio_routing_test');