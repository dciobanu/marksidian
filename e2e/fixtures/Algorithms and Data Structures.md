# Algorithms and Data Structures
## Combinatorics
Number of ways a number of elements can be arranged in: $N!$

Number of unique ways in case some elements appear more than once ($n_x$):
$$
\frac {N!}{n_1!*n_2!* ...*n_m!}
$$

Number of combinations of r elements from a set with n elements (n choose r where $0\le r \le n$):
$$_nC_r = \frac {n!}{r!(n-r)!}$$

## Disjoint Set
A set of sets that do not intersect:
**Implementation:** 
	Parent nodes array for identifying subsets
	Rank array for subsets
**Methods:** 
	`Add(value)` `Find(value)` `Union(value1, value2)`
**Complexity:** 
	Time: O(α(N))
	Space: O(N)
**Used in:**
	Tracking indirect connections in graphs

## Heap
Optimized for in-priority retrieval of added elements (aka Priority Queue)
**Implementation:**
	Dynamic array with an almost complete binary tree (other tree types possible) in it
**Methods:**
	`Add(value)` - add an element at the tail end of the array, then go toward the root swapping elements as needed
	`Pop()` - return the root of the tree, move tail to the root, start with the root and keep swapping values with left branches until the tree is in the right order again.
**Complexity:**
	Peek - O(1), Pop - O(log(n)), Add - O(log(n))
**Used in:**
	Fast min/max calculations of sliding window style data

## Bloom Filters
*k* - number of hash functions
*n* - number of the elements in the set
*m* - number of bits used

Probability of false-positives: $p = (1-e^{\frac{k*n}{m}})^k$
Number of bits required for a given probability p: $n*ln(\frac{1}{p})\div ln^2(2)$
Example: n=1mln items, 1% false positives
> $size = 10^6*ln(1/0.01) \div ln^2(2) \approx 9.965 mln$

Example: n=1mln items, 2% false positives
> $size = 10^6*ln(1/0.01) \div ln^2(2) \approx 8.14 mln$

Rule of thumb: 1 byte per element for 2% false positive probability, 10bits for 1%, 14bits for 0.1%, 20 bits for 0.01%, 24 bits for 0.001%. 32bits per element yield FP 0.00003% (0.3 from 1mln items)

## Graphs
**Tree** - undirected, connected, acyclic graph
**Spanning tree** - a sub-graph that is a tree which includes all of the vertices
**Minimum Spanning Tree** - a spanning tree with the minimum possible total weight

### Kruskal’s Algorithm
Expand MSP from a weighted undirected graph **by adding edges**:
	1. Sort ascendingly edges by weight
	2. Start adding edges in order skipping those that lead to a cycle being formed
	3. Use [[#Disjoint Set]] to detect cycles
**Complexity:**
	O(E\*log(E)), E is number of edges

### Prim’s Algorithm
Expand MSP from a weighted undirected graph **by adding vertices**:
	1. Use an array of bools to track in-set/out-of-set status of vertices
	2. Use a heap to keep track of edges connected to any of the in-set vertices
	3. `addVertex` - marks the vertex as visited and adds the edges connecting it and the out-of-set vertices into the heap
	4. `addVertex(0)` to start with 
	5. While not all nodes are in-set: Pop edges from the heap and if they lead to out-set call `addVertex`. Keep track of the cumulative weight.
**Complexity:**
	O(E\*log(V)) where E number of edges and V number of vertices

### Depth First Search Algorithm (DFS)
Visit nodes by choosing edges until there's no way to go. Then backtrack until an edge that hasn't been taken is available, and repeat. Implemented using a Stack and an Array of bools for tracking visited nodes.

**Complexity** for finding *any* path between two vertices
	Time: O(V+E), Space: O(V)
**Complexity** for finding some optimal path:
	Time: O((V-2)!), Space: O(V)

### Breadth First Search Algorithm (BFS)
Find the shortest path between two vertices in an unweighted graph
**Implementation:**
	1. Queue for paths to take and Array of bools for marking vertices as visited
	2. Start with a path of one element in the queue
	3. Pop a path from the queue
	4. Look at the edges from the last node and enqueue all paths to unvisited elements
	5. Mark the element as visited
	6. Repeat 3-5 until queue is empty or the last element is the sought destination
**Complexity:** 
	Time: O(V+E), Space: O(V)

### Dijkstra's Algorithm
Find shortest path in any weighted graph with *non-negative weights*
**Implementation:**
	1. Table to memorize for each vertex the distance and the previous node. Array of bools to remember visited status of the vertices (heap recommended)
	2. Start with the table containing $(0, V_{start} )$ for the starting node and $(\infty, -)$ for all other nodes
	3. Pick the unvisited vertex with the minimal distance from the table
	4. Look at vertices that can be reached from current vertex and if combined distance is smaller than what the table has, update the table
	5. Repeat 3 & 4 until all vertices are visited
**Complexity:**
	Time: O(V+ E\*log(V)), Space: O(V)

### Bellman Ford Algorithm
Find shortest path in any weighted graph with *non-negative **cycles***
**Implementation:**
	1. Table $T[N:N]$ to be used for storing the minimum distance possible from source, for a given number of total max edges. Row number is max edges and column is the vertex number.
	2. Initialize $T[i,j]$ with $\infty$
	3. Set $T[0,E_{start}] = 0$
	4. Iterate and use dynamic programming: $T[i,j]=min(T[i,j], T[i-1][j] + W_{ij})$
	5. To detect negative cycles, 4 can be repeated one extra time and if the value for destination decreases, the graph contains negative cycles
**Complexity:**
	Time: $O(V^2)$, Space: $O(V^2)$

### Kahn's Algorithm (Topological Sorting)
Sort actions based on their prior dependencies (for example study courses)
The dependency graph must be *directed and acyclic*.
**Implementation:**
Iteratively remove nodes that have zero dependencies decreasing the number of dependencies for dependents until all nodes are removed:
	1. $D[V_i]$ - number of dependencies for a given node, $Q[...]$ - processing queue, $E[Vi] \in \{true, false\}$ 
	2. Start with calculated D values, and E = false, and all nodes with in-degree 0 added to the queue
	3. Pop a node *n* from Q
	4. Add n to the sorted result
	5. $E[Vn]=true$ mark it as examined
	6. $D[V_i] = D[V_i]-1$ for all unvisited nodes that depend on $V_n$ and if $D[V_i]$ = 0, add them to Q
	7. Repeat 3-6 until all nodes have been examined or no independent nodes are left
**Complexity:**
	Time: $\Omega(V+E)$, Space: $\Omega(V+E)$

## Trees
### Layered traversing
To traverse the tree in layers:
1. Queue for the nodes
2. Start with Q: [root]
3. `node = Q::Pop(), q.Add(node.Left), qAdd(node.Right)`

