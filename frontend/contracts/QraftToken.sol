// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title QraftToken
 * @dev Custom ERC20 token for the Qraft quiz application
 * Users earn QRAFT tokens by completing quizzes
 */
contract QraftToken is ERC20, Ownable {
    // Token details
    uint8 private constant _decimals = 18;
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * (10 ** _decimals); // 1 million tokens
    
    // Reward amounts (in tokens, will be multiplied by 10^18)
    uint256 public quizReward = 10 * (10 ** _decimals); // 10 QRAFT per quiz
    uint256 public correctAnswerReward = 1 * (10 ** _decimals); // 1 QRAFT per correct answer
    
    // Authorized reward distributors (your backend)
    mapping(address => bool) public rewardDistributors;
    
    // Events
    event RewardDistributed(address indexed user, uint256 amount, string reason);
    event RewardDistributorUpdated(address indexed distributor, bool authorized);
    
    constructor() ERC20("Qraft Token", "QRAFT") Ownable(msg.sender) {
        // Mint initial supply to contract owner
        _mint(msg.sender, INITIAL_SUPPLY);
        
        // Owner is automatically a reward distributor
        rewardDistributors[msg.sender] = true;
    }
    
    /**
     * @dev Add or remove reward distributors (backend wallets)
     */
    function setRewardDistributor(address distributor, bool authorized) external onlyOwner {
        rewardDistributors[distributor] = authorized;
        emit RewardDistributorUpdated(distributor, authorized);
    }
    
    /**
     * @dev Distribute rewards to users (called by backend)
     */
    function distributeReward(address user, uint256 amount, string memory reason) external {
        require(rewardDistributors[msg.sender], "Not authorized to distribute rewards");
        require(balanceOf(address(this)) >= amount, "Insufficient contract balance");
        
        _transfer(address(this), user, amount);
        emit RewardDistributed(user, amount, reason);
    }
    
    /**
     * @dev Batch distribute rewards to multiple users
     */
    function batchDistributeRewards(
        address[] memory users, 
        uint256[] memory amounts,
        string memory reason
    ) external {
        require(rewardDistributors[msg.sender], "Not authorized to distribute rewards");
        require(users.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            require(balanceOf(address(this)) >= amounts[i], "Insufficient contract balance");
            _transfer(address(this), users[i], amounts[i]);
            emit RewardDistributed(users[i], amounts[i], reason);
        }
    }
    
    /**
     * @dev Update reward amounts
     */
    function updateRewardAmounts(uint256 newQuizReward, uint256 newCorrectAnswerReward) external onlyOwner {
        quizReward = newQuizReward;
        correctAnswerReward = newCorrectAnswerReward;
    }
    
    /**
     * @dev Fund the contract with tokens for distribution
     */
    function fundContract(uint256 amount) external onlyOwner {
        _transfer(msg.sender, address(this), amount);
    }
    
    /**
     * @dev Withdraw tokens from contract (emergency)
     */
    function withdrawTokens(uint256 amount) external onlyOwner {
        require(balanceOf(address(this)) >= amount, "Insufficient contract balance");
        _transfer(address(this), msg.sender, amount);
    }
    
    /**
     * @dev Get contract's token balance (available for rewards)
     */
    function getContractBalance() external view returns (uint256) {
        return balanceOf(address(this));
    }
}
