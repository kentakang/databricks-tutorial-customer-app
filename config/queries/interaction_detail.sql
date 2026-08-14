-- @param interaction_id STRING
SELECT
  cs.interaction_id,
  cs.interacted_at,
  cs.issue_category,
  cs.issue_description,
  cs.agent_id,
  c.customer_id,
  c.name AS customer_name,
  c.email,
  c.phone,
  c.address,
  c.customer_level
FROM customer_support_rag.support.cust_service AS cs
INNER JOIN customer_support_rag.support.customer AS c
  ON c.customer_id = cs.customer_id
WHERE cs.interaction_id = :interaction_id
LIMIT 1;
